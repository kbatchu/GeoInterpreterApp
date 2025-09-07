function Mediator() {
  var publicAPI = {};

  var mComponents = {};

  publicAPI.registerComponent = function(name, component) {
    var cmp;
    for (cmp in mComponents) {
      if (mComponents[cmp] === component) {
        break;
      }
    }
    component.setMediator(this);
    mComponents[name] = component;
  };

  // 30Nov2015 var unregisterComponent = function (name, component) {
  publicAPI.unregisterComponent = function(name) {
    if (!mComponents.hasOwnProperty(name)) {
      return;
    }

    delete mComponents[name];
  };

  publicAPI.broadcast = function(event, args, source) {
    var cmp;
    if (!event) {
      return;
    }
    args = args || [];
    for (cmp in mComponents) {
      if (typeof mComponents[cmp]["on" + event] == "function") {
        source = source || mComponents[cmp];
        mComponents[cmp]["on" + event].apply(source, args);
      }
    }
  };

  publicAPI.clearAllRegisteredComponents = function() {
    // 30Nov2015
    mComponents = {};
  };

  return publicAPI;
}
export default Mediator;
