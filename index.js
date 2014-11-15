#!/usr/bin/env node

var request = require('hyperquest');
var JSONStream = require('JSONStream');
var through = require('through2');

var token = process.env.TOKEN;

var req = request('https://api.github.com/notifications');
req.setHeader('Authorization', 'token ' + token);
req.setHeader('User-Agent', 'https://github.com/juliangruber/ghn');

req
.pipe(JSONStream.parse('*'))
.pipe(renderNotification())
.pipe(process.stdout);

function renderNotification(){
  var idx = 0;
  return through.obj(function(n, _, done){
    this.push(idx++ + ') ' + n.repository.full_name + ': ' + n.subject.title + '\n');
    done();
  });
}
