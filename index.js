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

    cmd(n, function(){
      console.log();
      list(ns);
    });
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
  gh(n.subject.latest_comment_url)
  .pipe(JSONStream.parse('body'))
  .on('end', cb)
  .pipe(process.stdout);
};
commands.read = function(n, cb){
  var req = gh('https://api.github.com/notifications/threads/' + n.id, 'PATCH');
  req.setHeader('Content-Length', '0');
  req.pipe(process.stdout);
  req.on('end', cb);
  req.end();
};

