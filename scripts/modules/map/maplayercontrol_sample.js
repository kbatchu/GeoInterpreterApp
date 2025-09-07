function MapLayerControl() {
  const publicAPI = {};
  let mMediator;
  let mMap;

  publicAPI.setMediator = function (m) {
    mMediator = m;
  };
  publicAPI.getMediator = function () {
    return mMediator;
  };

  publicAPI.setMap = function (m) {
    mMap = m;
  };

  function updateLayerControl() {
    const layerList = document.getElementById("layer-list");
    layerList.innerHTML = ""; // Clear existing controls

    mMap
      .getLayers()
      .getArray()
      .forEach((layer, i) => {
        const layerItem = document.createElement("div");
        layerItem.className = "layer-item";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = "layer" + i;
        input.checked = layer.getVisible();

        const label = document.createElement("label");
        label.htmlFor = "layer" + i;
        label.innerHTML = layer.get("title");

        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "Remove";
        removeBtn.className = "remove-btn";

        input.addEventListener("change", () => {
          toggleLayer(layer.get("title"));
        });

        removeBtn.addEventListener("click", () => {
          removeLayer(layer.get("title"));
        });

        layerItem.appendChild(input);
        layerItem.appendChild(label);
        layerItem.appendChild(removeBtn);
        layerList.appendChild(layerItem);
      });
  }

  publicAPI.addLayer = function (title, source, type = "overlay") {
    const newLayer = new ol.layer.Tile({
      title: title,
      type: type,
      source: source,
      visible: true
    });
    mMap.addLayer(newLayer);
    updateLayerControl();
  };

  

  

  publicAPI.init = function (config) {
    mMap = config.Map;
    // Initial call to create layer controls
    updateLayerControl();
  };
}
export default MapLayerControl;
