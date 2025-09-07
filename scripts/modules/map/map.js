import Map from "ol/Map";
import View from "ol/View";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from "ol/layer/Tile";
import { Fill, Stroke, Circle, Style } from "ol/style";

function OLMap() {
  const publicAPI = {};
  let mMap;
  let mMapView;
  let mMapLayers = [];

  function createMap(config) {
    const osmLayer = new TileLayer({
      title: "OpenStreetMap",
      source: new OSM(),
      type: "base",
      visible: true,
    });

    const satelliteLayer = new TileLayer({
      title: "Satellite",
      source: new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      }),
      type: "base",
      visible: false,
    });

    mMapLayers.push(osmLayer);
    mMapLayers.push(satelliteLayer);

    mMapView = new View({
      center: [0, 0],
      zoom: 2,
    });

    mMap = new Map({
      target: config.target,
      layers: mMapLayers,
      view: mMapView,
    });
  }

  publicAPI.getMap = function () {
    return mMap;
  };

  publicAPI.init = function (config) {
    createMap(config);
  };

  return publicAPI;
}

export default OLMap;