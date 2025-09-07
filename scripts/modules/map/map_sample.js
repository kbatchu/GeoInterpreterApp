import $ from "jquery";
import * as d3 from "d3";
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
  let mMediator;
  let mMap;
  let mMapView;
  let mConfig;
  let mMapLayers = [];
  // 30Aug2024 let mMapID;
  let mHighlightedFeature;
  let mHighlightedFeatureOrigStyle;
  let mOverlayLyr;
  let mMousePosition;

  publicAPI.setMediator = function (m) {
    mMediator = m;
  };
  publicAPI.getMediator = function () {
    return mMediator;
  };

  const mClickEventHandlers = {
    // 31Aug2024 ["#btnMapZoomReset_" + mConfig.MapContainerID]: handleMapZoomResetClick
  };

  function handleMapZoomResetClick() {
    zoomToMapExtent();
  }

  // 18Aug2024
  function getHighlightFeatureStyle(feature) {
    const geometryType = feature.getGeometry().getType();

    switch (geometryType) {
      case "Point":
      case "MultiPoint":
        return new Style({
          image: new Circle({
            radius: 5,
            fill: new Fill({ color: "#4ef1ba" })
          })
        });
      case "LineString":
      case "MultiLineString":
        return new Style({
          stroke: new Stroke({
            color: "#4ef1ba",
            width: 2
          })
        });
      case "Polygon":
      case "MultiPolygon":
        return new Style({
          fill: new Fill({
            color: "green"
          }),
          stroke: new Stroke({
            color: "green",
            width: 1
          })
        });
      default:
        return new Style({
          stroke: new Stroke({
            color: "black",
            width: 1
          })
        });
    }
  }

  function addEventListeners() {
    $.each(mClickEventHandlers, function (k, v) {
      $(document).on("click", k, v);
    });

    const container = document.getElementById(mConfig.MapContainerID);
    container.addEventListener("mouseout", function () {
      mMousePosition = null;
      mMap.render();
      hideMapTooltip();
      unHighlightFeature();
    });

    // 31Aug2024
    $(document).on(
      "click",
      "#btnMapZoomReset_" + mConfig.MapContainerID,
      handleMapZoomResetClick
    );
  }

  function isInvalidFeature(feature) {
    if (
      !feature ||
      !Object.prototype.hasOwnProperty.call(
        feature.getProperties(),
        "COUNTY_FIPS"
      )
    ) {
      return true;
    }
    return false;
  }

  function hideMapTooltip() {
    d3.select("#" + mConfig.MapTooltipElemID)
      .style("display", "none")
      .html("");
  }

  // 17Aug2024
  function unHighlightFeature() {
    if (mHighlightedFeature) {
      mHighlightedFeature.setStyle(mHighlightedFeatureOrigStyle);
      mOverlayLyr.getSource().removeFeature(mHighlightedFeature);
      mHighlightedFeature = null;
    }
  }

  function highlightFeature(feature) {
    if (feature !== mHighlightedFeature) {
      if (mHighlightedFeature) {
        mHighlightedFeature.setStyle(mHighlightedFeatureOrigStyle);
        mOverlayLyr.getSource().removeFeature(mHighlightedFeature);
      }
      if (feature) {
        mHighlightedFeatureOrigStyle = feature.getStyle();
        // 18Aug2024 feature.setStyle(mHighlightFeatureStyle);
        const highlightStyle = getHighlightFeatureStyle(feature); // 18Aug2024
        feature.setStyle(highlightStyle); // 18Aug2024
        mOverlayLyr.getSource().addFeature(feature);
      }
      mHighlightedFeature = feature; // 25Sep2020
    }
  }

  // 17Aug2024
  function getTooltipHTML(feature) {
    let tooltipHTML;

    const properties = feature.getProperties();
    const propertiesArr = Object.keys(properties)
      .map(function (key) {
        return [key, properties[key]];
      })
      .filter(function (d) {
        return d[0] !== "geometry";
      });

    tooltipHTML = '<div><div style="text-align:left">';

    propertiesArr.map(function (d) {
      tooltipHTML += `<b>${d[0]}:</b> ${d[1]}<br>`;
    });

    tooltipHTML += "</div></div>";

    return tooltipHTML;
  }

  function getToolTipCoords(posX, posY) {
    let pX;
    let pY;

    pX = posX;
    pY = posY;

    const maxRight =
      $(window).innerWidth() - $("#" + mConfig.MapTooltipElemID).width() - 25;
    const maxDown =
      $(window).innerHeight() - $("#" + mConfig.MapTooltipElemID).height() - 25;

    if (pX > maxRight) {
      pX = maxRight;
    }

    if (pY > maxDown) {
      pY = maxDown;
    }

    const pos = { PosX: pX, PosY: pY };

    return pos;
  }

  function displayMapTooltip(evt) {
    const pixel = mMap.getEventPixel(evt.originalEvent);
    const feature = mMap.forEachFeatureAtPixel(pixel, function (feat) {
      return feat;
    });

    if (!feature) {
      hideMapTooltip();
      unHighlightFeature();
      return;
    }

    const tooltipHTML = getTooltipHTML(feature);
    highlightFeature(feature);

    const offset = 30;
    const posX = evt.originalEvent.clientX + offset;
    // 17Aug2024  const posY = evt.originalEvent.clientY + offset / 3;
    const yScroll =
      window.pageYOffset !== undefined
        ? window.pageYOffset
        : document.documentElement.scrollTop; // 17Aug2024
    const posY = evt.originalEvent.clientY + yScroll + offset / 3; // 17Aug2024

    d3.select("#" + mConfig.MapTooltipElemID).html(tooltipHTML);
    const pos = getToolTipCoords(posX, posY);

    d3.select("#" + mConfig.MapTooltipElemID)
      .style("display", "block")
      .style("opacity", 0.8)
      .style("top", pos.PosY + "px")
      .style("left", pos.PosX + "px");
  }

  function addOverlayLyr() {
    const overlayLyrSource = new VectorSource();
    mOverlayLyr = new VectorLayer({
      title: "Map Overlay",
      source: overlayLyrSource
    });
    mMapLayers.push(mOverlayLyr);
  }

  // 18Aug2024
  const styleFunction = function (feature) {
    const geometryType = feature.getGeometry().getType();

    switch (geometryType) {
      case "Point":
      case "MultiPoint":
        return new Style({
          image: new Circle({
            radius: 5,
            fill: new Fill({ color: "rgba(104, 78, 241)" })
          })
        });
      case "LineString":
      case "MultiLineString":
        return new Style({
          stroke: new Stroke({
            color: "#684ef1",
            width: 3
          })
        });
      case "Polygon":
      case "MultiPolygon":
        return new Style({
          fill: new Fill({
            color: "rgba(104, 78, 241, 0.6)"
          }),
          stroke: new Stroke({
            color: "rgba(	241, 104, 78, 0.6)",
            width: 1
          })
        });
      default:
        return new Style({
          stroke: new Stroke({
            color: "black",
            width: 1
          })
        });
    }
  };

  function getLayerByTitle(title) {
    const allLayers = mMap.getAllLayers();

    const lyr = allLayers.find(function (layer) {
      return layer.getProperties().title === title;
    });
    return lyr;
  }

  function zoomToMapExtent() {
    const duration = 1500;

    const cosineSimCountiesLyrSource = getLayerByTitle(
      mConfig.LayerName
    ).getSource(); // 13Oct2023
    const layerExtent = cosineSimCountiesLyrSource.getExtent();

    const zoomLevel = mMapView.getZoom() - 1.5;
    mMapView.animate({ zoom: zoomLevel, duration: duration / 2 }, function () {
      mMapView.fit(layerExtent, {
        size: mMap.getSize(),
        duration: duration / 2
      });
    });
  }

  function createMap() {
    $("#" + mConfig.MapContainerID).empty();

    /*  // 18Aug2024
    const fill = new Fill({
      color: "rgba(104, 78, 241, 0.6)"
    });

    const stroke = new Stroke({
      color: "rgba(	241, 104, 78, 0.6)",
      width: 1
    });

    const style = new Style({
      fill: fill,
      stroke: stroke
    });
 */
    // ? add basemap layer
    const baseMapLyr = new TileLayer({ className: "bw", source: new OSM() });
    mMapLayers.push(baseMapLyr);

    // ? create Vector source and insert geojson object
    const vectorLyrSource = new VectorSource({
      features: new GeoJSON().readFeatures(mConfig.GeoJSONData)
    });
    const polyLyr = new VectorLayer({
      title: mConfig.LayerName,
      source: vectorLyrSource,
      minZoom: 3,
      maxZoom: 23,
      style: styleFunction
    });
    mMapLayers.push(polyLyr);

    addOverlayLyr();

    mMapView = new View({
      zoom: 4
    });

    mMap = new Map({
      layers: mMapLayers,
      target: mConfig.MapContainerID,
      view: mMapView
    });

    // ? fit to map extent
    const layerExtent = vectorLyrSource.getExtent(); // ? get layer extent
    mMapView.fit(layerExtent, {
      size: mMap.getSize()
    });

    mMap.on("pointermove", function (evt) {
      if (evt.dragging) {
        return;
      }

      displayMapTooltip(evt);
    });

    mMap.render();
  }

  function addMapZoomResetBtn() {
    /* if ($("#btnMapZoomReset").length) {
      return;
    }
    $(".ol-zoom").append(
      '<button id="btnMapZoomReset" class="da-olmap-zoom-reset da-zoom-reset-empty" aria-label="reset map zoom"><i class="bi bi-globe da-zoom-reset-empty"></i></button>'
    ); */

    if (
      $("#" + mConfig.MapContainerID).find(
        "#btnMapZoomReset_" + mConfig.MapContainerID
      ).length
    ) {
      return;
    }
    $("#" + mConfig.MapContainerID)
      .find(".ol-zoom")
      .append(
        `<button id="btnMapZoomReset_${mConfig.MapContainerID}" class="da-olmap-zoom-reset da-zoom-reset-empty" aria-label="reset map zoom"><i class="bi bi-globe da-zoom-reset-empty"></i></button>`
      );
  }

  // 30Aug2024
  publicAPI.clearMap = function () {
    const vectorLyr = getLayerByTitle(mConfig.LayerName);
    vectorLyr.getSource().clear();
  };

  publicAPI.updateSize = function () {
    mMap.updateSize();
  };

  publicAPI.init = function (config) {
    mConfig = config;

    createMap();
    addMapZoomResetBtn();
    addEventListeners();
  };

  return publicAPI;
}
export default OLMap;
