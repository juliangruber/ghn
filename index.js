#!/usr/bin/env node

var request = require('hyperquest');
var JSONStream = require('JSONStream');
var through = require('through2');
var readline = require('readline');
var open = require('open');
var concat = require('concat-stream');
var pad = require('pad');
var PassThrough = require('stream').PassThrough;
var readonly = require('read-only-stream');
var getUpdates = require('gh-issue-updates');

var token = process.env.TOKEN;
var ns = [];

list(ns);

function list(ns){
  gh('https://api.github.com/notifications')
  .pipe(JSONStream.parse('*'))
  .pipe(save(ns))
  .pipe(indexify())
  .pipe(render())
  .on('end', function(){
    if (ns.length) prompt(ns);
    else console.error('No unread notifications.');
  })
  .pipe(process.stdout);
}

function gh(url, method){
  method = method || 'GET';
  var req = request(url, { method: method });
  var out = PassThrough();
  out.pipe(req);
  out.setHeader = req.setHeader.bind(req);
  req.setHeader('Authorization', 'token ' + token);
  req.setHeader('User-Agent', 'https://github.com/juliangruber/ghn');
  req.on('response', function(res){
    if (String(res.statusCode)[0] == 2) {
      res.pipe(out);
    } else {
      console.error('Status %s', res.statusCode);
      res.pipe(process.stderr, { end: false });
      res.on('end', function(){
        console.log();
        process.exit(1);
      });
    }
  });
  return out;
}

function render(){
  return through.obj(function(o, _, done){
    var idx = o.idx + 1;
    var n = o.n;
    this.push(pad(3, idx) + ') ' + n.repository.full_name + ': ' + n.subject.title + '\n');
    done();
  });
}

function save(ns){
  return through.obj(function(n, _, done){
    ns.push(n);
    done(null, n);
  });
}

function indexify(){
  var idx = 0;
  return through.obj(function(n, _, done){
    this.push({
      idx: idx++,
      n: n
    });
    done();
  })
}

function prompt(ns){
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Command: ', function(line){
    rl.close();
    var segs = line.split(' ');

    var cmd = commands[segs[0]];
    if (!cmd) return prompt();

    var n = ns[segs[1] - 1];
    if (!n) return prompt();

    console.log();
    cmd(n, function(){
      console.log();
      list(ns);
    });
  });
}

function lastChunk(){
  var chunk;
  return through.obj(function(c, _, done){
    chunk = c;
    done();
  }, function(done){
    this.push(chunk);
    done();
  });
}

var commands = {};
commands.view = function(n, cb){
  gh(n.subject.url)
  .pipe(JSONStream.parse('html_url'))
  .pipe(concat(open))
  .on('finish', cb);
};
commands.peek = function(n, cb){
  if (n.subject.type == 'Issue' || n.subject.type == 'PullRequest') {
    var since = new Date(n.last_read_at || n.updated_at);

    getUpdates({
      issue: n.subject.url.split('/').pop(),
      repo: n.repository.full_name,
      token: token
    }, function(err, updates){
      if (err) throw err;
      var ignore = [
        'subscribed',
        'mentioned',
        'referenced'
      ];
      updates
      .filter(function(u){
        return (new Date(u.data.created_at)) - since >= -1000
          && ignore.indexOf(u.data.event) == -1
      })
      .forEach(function(u){
        console.log('---');
        switch (u.type) {
          case 'comment':
            console.log('@%s: %s', u.data.user.login, u.data.body);
            break;
          case 'event':
            switch (u.data.event) {
              case 'merged':
                console.log('@%s merged.', u.data.actor.login);
                break;
              case 'closed':
                console.log('@%s closed.', u.data.actor.login);
                break;
              case 'assigned':
                console.log('@%s assigned to @%s.', u.data.actor.login, u.data.assignee.login);
                break;
              default:
                throw new Error('event: ' + u.data.event);
            }
            break;
          case 'issue':
            console.log(
              '#%s %s (@%s)\n\n%s',
              u.data.number,
              u.data.title,
              u.data.user.login,
              u.data.body
            );
            break;
          default:
            throw new Error('type: ' + u.type);
        }
      });
      console.log('---\n');
      cb();
    });
  } else if (n.subject.type == 'Commit') {
    gh(n.subject.url)
    .pipe(JSONStream.parse('commit.message'))
    .pipe(concat(function(m){
      console.log('Message: %s', m);
      cb();
    }));
  } else {
    throw new Error('type: ' + n.subject.type);
  }
};
commands.read = function(n, cb){
  var req = gh('https://api.github.com/notifications/threads/' + n.id, 'PATCH');
  req.setHeader('Content-Length', '0');
  req.pipe(process.stdout);
  req.on('end', cb);
  req.end();
};

