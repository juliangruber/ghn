#!/usr/bin/env node

var request = require('hyperquest');
var JSONStream = require('JSONStream');
var through = require('through2');
var readline = require('readline');
var open = require('open');
var concat = require('concat-stream');
var pad = require('pad');

var token = process.env.TOKEN;
var ns = [];

gh('https://api.github.com/notifications')
.pipe(JSONStream.parse('*'))
.pipe(save(ns))
.pipe(indexify())
.pipe(render())
.on('end', function(){
  prompt(ns);
})
.pipe(process.stdout);

function gh(url){
  var req = request(url);
  req.setHeader('Authorization', 'token ' + token);
  req.setHeader('User-Agent', 'https://github.com/juliangruber/ghn');
  return req;
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
  rl.question('View? ', function(idx){
    rl.close();
    var n = ns[idx - 1];
    if (!n) return prompt();

    gh(n.subject.url)
    .pipe(JSONStream.parse('html_url'))
    .pipe(concat(function(url){
      open(url);
    }))
  });
}
