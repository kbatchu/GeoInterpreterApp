function MapLayerControl() {
  const publicAPI = {};
  let mMap;

  function updateLayerControl() {
    const layerList = document.getElementById("layer-list");
    if (!layerList) return;
    layerList.innerHTML = "";

    mMap.getLayers().forEach((layer) => {
      const layerItem = document.createElement("div");
      layerItem.className = "layer-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = layer.getVisible();
      input.id = layer.get("title");

      const label = document.createElement("label");
      label.htmlFor = layer.get("title");
      label.innerHTML = layer.get("title");

      input.addEventListener("change", () => {
        layer.setVisible(input.checked);
      });

      layerItem.appendChild(input);
      layerItem.appendChild(label);
      layerList.appendChild(layerItem);
    });
  }

  publicAPI.init = function (config) {
    mMap = config.map;
    updateLayerControl();
  };

  return publicAPI;
}

export default MapLayerControl;