'use strict';

var infer = require('tern/lib/infer');
var tern = require('tern');
var fs = require('fs');
var path = require('path');

require('tern/plugin/node');

var currentSource;

tern.defineQueryType('react.isComponent', {
  takesFile: true,
  run: function(srv, query, file) {
    var expr = tern.findQueryExpr(file, query);
    var type = infer.expressionType(expr);
    type = type.getType();
    if (!type.props || !type.props.prototype) {
      return false;
    }
    var proto = type.props.prototype.types[0];
    while (proto && /^React(Class)?Component\.prototype$/.test(proto.name) === false) {
      proto = proto.proto;
    }
    if (!proto) {
      return false;
    }
    return true;
  }
});

tern.defineQueryType('react.componentProperties', {
  takesFile: true,
  run: function(srv, query, file) {
    var expr = tern.findQueryExpr(file, query);
    var type = infer.expressionType(expr);
    type = type.getType();
    if (!type.props || !type.props.prototype) {
      return {};
    }
    var obj = type.props.prototype.types[0];
    var props = {};
    while (obj.proto && /^React(Class)?Component\.prototype$/.test(obj.name) === false) {
      props = Object.assign(props, obj.hasCtor.props);
      props = Object.assign(props, obj.props);
      obj = obj.proto;
    }
    delete props.prototype;
    return props;
  }
});

var server = new tern.Server({
  plugins: {
    node: {},
    es_modules: {}
  },
  getFile: function(name) {
    if (/<input>$/.test(name)) {
      return currentSource;
    }
    if (path.isAbsolute(name) === false) {
      name = '/' + name;
    }
    return fs.readFileSync(path.resolve(__dirname, name), 'utf8');
  },
  defs: [
    require('tern/defs/ecma5'),
    require('tern/defs/ecma6')
  ]
});

module.exports = function(type, file, source, node, callback) {
  var end = (node.id || node.superClass).range[1];
  currentSource = source;
  if (file === '<input>') {
    file = path.resolve(process.cwd(), file);
    server.delFile(file);
  }
  server.request({
    query: {
      file: file,
      type: type,
      end: end
    }
  }, callback);
};
