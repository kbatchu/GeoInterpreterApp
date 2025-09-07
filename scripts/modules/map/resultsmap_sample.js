import $ from "jquery";
import * as d3 from "d3";
import Map from "ol/Map";
import View from "ol/View";
import OSM from "ol/source/OSM";
import XYZSource from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import WebGLVectorLayer from "ol/layer/WebGLVector.js"; // 04Feb2025
import GeoJSON from "ol/format/GeoJSON";
import WKB from "ol/format/WKB.js"; // Custom WKB parser  // 05Feb2025
import Feature from "ol/Feature.js"; // 05Feb2025
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import { extend, createEmpty } from "ol/extent";
import { Fill, Stroke, Circle, Style } from "ol/style";
import Sortable from "sortablejs"; // Import Sortable

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
  let mActiveMapVectorLyr; // ? most recent vector layer added to map
  let mActiveMapLyrName; // 25Jan2025
  // 13Feb2025
  const mGeometryTypes = {
    Point: "POINT",
    MultiPoint: "MULTIPOINT",
    Polygon: "POLYGON",
    MultiPolygon: "MULTIPOLYGON",
    Line: "LINESTRING",
    MultiLine: "MULTILINESTRING",
    Unknown: "UNKNOWN"
  };

  const mClickEventHandlers = {
    // 04Mar2025  ".add-basemap-layer-btn": handleAddBasemapLayerBtnClickEvent
  };

  /* // 04Mar2025 
  function handleAddBasemapLayerBtnClickEvent(evt) {
    const clickedElemID = $(evt.target).attr("id");
    let lyrSource;
    if (clickedElemID === "satellite") {
      lyrSource = new XYZSource({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      });
      publicAPI.addTileLayer(lyrSource, "Satellite");
    }
  } */

  publicAPI.getActiveMapLayerName = function () {
    return mActiveMapLyrName;
  };

  publicAPI.setMediator = function (m) {
    mMediator = m;
  };
  publicAPI.getMediator = function () {
    return mMediator;
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
            color: "#4ef1ba"
          }),
          stroke: new Stroke({
            color: "#4ef1ba",
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
        return d[0] !== "geometry" && d[0] !== "geometry_bbox";
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
    const feature = mMap.forEachFeatureAtPixel(
      pixel,
      function (feat) {
        return feat;
      },
      {
        layerFilter: function (layer) {
          return layer.get("title") === mActiveMapLyrName;
        }
      }
    );

    if (!feature) {
      hideMapTooltip();
      unHighlightFeature();
      return;
    }

    const tooltipHTML = getTooltipHTML(feature);
    highlightFeature(feature);

    const offset = 30;
    const posX = evt.originalEvent.clientX + offset;
    const yScroll =
      window.pageYOffset !== undefined
        ? window.pageYOffset
        : document.documentElement.scrollTop; // 17Aug2024
    const posY = evt.originalEvent.clientY + yScroll + offset / 3; // 17Aug2024

    d3.select("#" + mConfig.MapTooltipElemID).html(tooltipHTML);
    const pos = getToolTipCoords(posX, posY);

    d3.select("#" + mConfig.MapTooltipElemID)
      .style("display", "block")
      .style("opacity", 0.9)
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
  // 23Feb2025 const styleFunction = function (feature) {
  const styleFunction = function (feature, categoryColumn, categoryColors) {
    const geometryType = feature.getGeometry().getType();
    let defaultPointColor = "rgba(104, 78, 241)"; // Default color  // 23Feb2025
    let defaultLineStrokeColor = "#684ef1";
    let defaultPolygonFillColor = "rgba(104, 78, 241, 0.6)";
    let defaultPolygonStrokeColor = "rgba(99, 93, 93, 0.5)"; //"rgba(	241, 104, 78, 0.6)";

    // 23Feb2025
    let color;
    if (categoryColors) {
      const categoryValue = feature.get(categoryColumn);
      const categoryColor = categoryColors.find(
        (c) => c.value === categoryValue
      );
      if (categoryColor) {
        color = categoryColor.color;
      }
    }

    switch (geometryType) {
      case "Point":
      case "MultiPoint":
        return new Style({
          image: new Circle({
            radius: 5,
            // 23Feb2025 fill: new Fill({ color: "rgba(104, 78, 241)" })
            fill: new Fill({ color: color || defaultPointColor })
          })
        });
      case "LineString":
      case "MultiLineString":
        return new Style({
          stroke: new Stroke({
            // 23Feb2025 color: "#684ef1",
            color: color || defaultLineStrokeColor,
            width: 3
          })
        });
      case "Polygon":
      case "MultiPolygon":
        return new Style({
          fill: new Fill({
            // 23Feb2025 color: "rgba(104, 78, 241, 0.6)"
            color: color || defaultPolygonFillColor
          }),
          stroke: new Stroke({
            // 23Feb2025 color: "rgba(	241, 104, 78, 0.6)",
            color: defaultPolygonStrokeColor,
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

    if (!mActiveMapVectorLyr) {
      console.warn("No vector layers found.");
      return;
    }

    const layerExtent = mActiveMapVectorLyr.getSource().getExtent();

    const zoomLevel = mMapView.getZoom() - 1.5;
    mMapView.animate({ zoom: zoomLevel, duration: duration / 2 }, function () {
      mMapView.fit(layerExtent, {
        // 20Jan2025 mMapView.fit(maxExtent, {
        size: mMap.getSize(),
        duration: duration / 2
      });
    });
  }

  function createMap() {
    $("#" + mConfig.MapContainerID).empty();

    // ? add Satellite basemap layer

    const satelliteMapLyr = new TileLayer({
      className: "sat",
      source: new XYZSource({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      }),
      title: "Satellite Base map",
      visible: false
    });

    mMapLayers.push(satelliteMapLyr);

    // ? add basemap layer
    const baseMapLyr = new TileLayer({
      className: "bw",
      source: new OSM(),
      title: "OSM Base map"
    });
    mMapLayers.push(baseMapLyr);

    addOverlayLyr();

    mMapView = new View({
      center: fromLonLat([-95.7129, 37.0902]),
      zoom: 4.9
    });

    mMap = new Map({
      layers: mMapLayers,
      target: mConfig.MapContainerID,
      view: mMapView
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

  // 07Mar2025
  function unselectAllLayers() {
    // Get all layer items
    const layerItems = document.querySelectorAll(".layer-item");

    // Remove the active-map-layer class from all layer items
    layerItems.forEach((item) => {
      item.classList.remove("active-map-layer");
    });
  }

  // 07Mar2025
  function selectLayer(layerTitle) {
    // Skip selection if this is a base map layer
    if (layerTitle === "OSM Base map" || layerTitle === "Satellite Base map") {
      return;
    }

    // Find the layer item with the matching title
    const layerItems = document.querySelectorAll(".layer-item");

    layerItems.forEach((item) => {
      if (item.getAttribute("data-layer-title") === layerTitle) {
        item.classList.add("active-map-layer");
        // Update the active map layer name
        mActiveMapLyrName = layerTitle;

        // Find and set the active vector layer
        const layer = getLayerByTitle(layerTitle);
        if (layer instanceof VectorLayer) {
          mActiveMapVectorLyr = layer;
        }
      }
    });
  }

  // 07Mar2025
  function updateLayerControl() {
    const layerList = document.getElementById("layer-list");
    layerList.innerHTML = ""; // Clear existing controls

    // get layers array which does not include 'Map Overlay' layer
    const layers = mMap
      .getLayers()
      .getArray()
      .filter((layer) => layer.get("title") !== "Map Overlay");

    layers.forEach((layer, i) => {
      const layerItem = document.createElement("div");
      if (layer.get("title") === mActiveMapLyrName) {
        layerItem.className = "layer-item active-map-layer ps-1";
      } else {
        layerItem.className = "layer-item";
      }

      // Add a class to make the layerItem a target for drag and drop.
      layerItem.classList.add("layer-item-sortable");
      layerItem.setAttribute("data-layer-title", layer.get("title")); // store the layer title to data-layer-title attribute

      // Add drag handle icon
      const dragHandle = document.createElement("div");
      dragHandle.className = "drag-handle";
      dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';

      // Create a container for the layer info
      const layerInfoContainer = document.createElement("div");
      layerInfoContainer.className = "layer-info";

      // Add layer visibility toggle
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "layer" + i;
      input.checked = layer.getVisible();
      input.className = "layer-visibility-toggle";

      // Stop propagation on the checkbox to prevent parent clicks from interfering,  // 07Mar2025
      input.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      // Make the layer info container clickable to select the layer,  // 07Mar2025
      layerInfoContainer.addEventListener("click", (e) => {
        // Only handle clicks if they're not on the checkbox or its children
        if (
          !e.target.closest(".layer-visibility-toggle") &&
          e.target !== input
        ) {
          // deselect all layers when one is clicked
          unselectAllLayers();
          // Here you can add code to select/highlight the layer if needed
          const layerTitle = layer.get("title");
          selectLayer(layerTitle);
        }
      });

      // Create a container for the layer name
      const labelContainer = document.createElement("div");
      labelContainer.className = "layer-name-container";

      // Add appropriate icon based on layer type
      const layerIcon = document.createElement("span");
      layerIcon.className = "layer-type-icon me-2";

      // Determine icon based on layer type
      if (layer instanceof TileLayer) {
        layerIcon.innerHTML = '<i class="bi bi-grid-3x3"></i>';
      } else if (layer instanceof VectorLayer) {
        // Check geometry type of first feature if available
        const source = layer.getSource();
        const features = source.getFeatures();
        if (features && features.length > 0) {
          const geometry = features[0].getGeometry();
          if (geometry) {
            const geomType = geometry.getType().toLowerCase();
            if (geomType.includes("point")) {
              layerIcon.innerHTML = '<i class="fg-multipoint"></i>';
            } else if (geomType.includes("line")) {
              layerIcon.innerHTML = '<i class="fg-polyline"></i>';
            } else if (geomType.includes("polygon")) {
              layerIcon.innerHTML = '<i class="fg-polygon"></i>';
            } else {
              layerIcon.innerHTML = '<i class="bi bi-layers"></i>';
            }
          } else {
            layerIcon.innerHTML = '<i class="bi bi-layers"></i>';
          }
        } else {
          layerIcon.innerHTML = '<i class="bi bi-layers"></i>';
        }
      } else {
        layerIcon.innerHTML = '<i class="bi bi-layers"></i>';
      }

      const label = document.createElement("label");
      // 07Mar2025label.htmlFor = "layer" + i;
      // 05Mar2025 label.innerHTML = layer.get("title");
      // ? Replace underscores with a zero-width space followed by underscore
      // ? This allows browsers to break at underscore positions
      const formattedTitle = layer.get("title").replace(/_/g, "\u200B_"); // 05Mar2025
      label.innerHTML = formattedTitle; // 05Mar2025

      // Add layer controls container
      const layerControls = document.createElement("div");
      layerControls.className = "layer-controls";

      // Add opacity control
      const opacityControl = document.createElement("div");
      opacityControl.className = "opacity-control";
      opacityControl.innerHTML = '<i class="bi bi-opacity"></i>';
      opacityControl.title = "Adjust layer opacity";

      opacityControl.addEventListener("click", (e) => {
        e.stopPropagation();
        // Show opacity slider (implementation would be needed)
        // This is a placeholder for future functionality
        alert(`Adjust opacity for ${layer.get("title")}`);
      });

      // Add remove button if not base map
      let removeBtn = null;
      if (
        layer.get("title") !== "OSM Base map" &&
        layer.get("title") !== "Satellite Base map"
      ) {
        removeBtn = document.createElement("button");
        removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
        removeBtn.className = "remove-btn";
        removeBtn.title = "Remove layer";

        removeBtn.addEventListener("click", () => {
          publicAPI.removeLayer(layer.get("title"));
        });
      }

      // Assemble the layer item
      labelContainer.appendChild(layerIcon);
      labelContainer.appendChild(label);

      // 07Mar2025 layerInfoContainer.appendChild(input);
      // Create a separate container for the checkbox to isolate it
      const checkboxContainer = document.createElement("div");
      checkboxContainer.className = "checkbox-container";
      checkboxContainer.appendChild(input);
      layerInfoContainer.appendChild(checkboxContainer);
      layerInfoContainer.appendChild(labelContainer);

      if (removeBtn) {
        layerControls.appendChild(opacityControl);
        layerControls.appendChild(removeBtn);
      }

      layerItem.appendChild(dragHandle);
      layerItem.appendChild(layerInfoContainer);
      layerItem.appendChild(layerControls);
      layerList.appendChild(layerItem);

      // Add event listener for visibility toggle
      input.addEventListener("change", () => {
        publicAPI.toggleLayer(layer.get("title"));
      });
    });

    // Initialize Sortable with improved handle
    const sortable = Sortable.create(layerList, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "layer-item-ghost",
      chosenClass: "layer-item-chosen",
      dragClass: "layer-item-drag",
      onEnd: function (evt) {
        reorderLayers(evt);
      }
    });
  }

  // 04Mar2025
  function reorderLayers(evt) {
    const movedLayerTitle = evt.item.getAttribute("data-layer-title");
    const oldIndex = evt.oldIndex;
    const newIndex = evt.newIndex;

    // Get all layers from the map
    const allLayers = mMap.getLayers();
    const layersArray = allLayers.getArray();

    // Find the moved layer
    const movedLayer = layersArray.find(
      (layer) => layer.get("title") === movedLayerTitle
    );

    if (!movedLayer) {
      console.error("Could not find layer with title:", movedLayerTitle);
      return;
    }

    // Remove the layer from its current position
    allLayers.remove(movedLayer);

    // Calculate the correct insertion index
    // We need to account for the Map Overlay layer which is excluded from the layer list
    const visibleLayers = layersArray.filter(
      (layer) => layer.get("title") !== "Map Overlay"
    );
    const insertIndex = newIndex;

    // Insert at the new position
    allLayers.insertAt(insertIndex, movedLayer);

    // Update the global mMapLayers array to match the new order
    mMapLayers = mMap.getLayers().getArray();

    // Refresh the map
    mMap.render();
  }

  // 23Feb2025
  // Helper function to convert hex to RGBA
  function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 1]; // Alpha is set to 1 by default
  }

  // Create a style function for WebGLVector layer for point, line, and polygon features
  // 23Feb2025 function getWebGLStyleProperties(geometryType) {
  function getWebGLStyleProperties(feature, categoryColumn, categoryColors) {
    const geometryType = feature.getGeometry().getType().toUpperCase();
    let defaultPointColor = "rgba(104, 78, 241)"; // Default color  // 23Feb2025
    let defaultLineStrokeColor = "#684ef1";
    let defaultPolygonFillColor = "rgba(104, 78, 241, 0.6)";
    let defaultPolygonStrokeColor = "rgba(0,0,0, 0.5)";

    let color;
    if (categoryColors) {
      const categoryValue = feature.get(categoryColumn);
      const categoryColor = categoryColors.find(
        (c) => c.value === categoryValue
      );
      if (categoryColor) {
        color = categoryColor.color;
        // Convert hex color to RGBA
        if (typeof color === "string" && color.startsWith("#")) {
          color = hexToRgba(color);
        }
      }
    }

    switch (geometryType.toUpperCase()) {
      case mGeometryTypes.Point:
      case mGeometryTypes.MultiPoint:
        return {
          // "stroke-color": [0, 0, 0, 0.6],
          // "stroke-width": 1,
          "circle-radius": 3,
          // 23Feb2025 "circle-fill-color": [241, 104, 78, 1]
          "circle-fill-color": color || defaultPointColor
        };
      case mGeometryTypes.Line:
      case mGeometryTypes.MultiLine:
        // 23Feb2025 return { "stroke-color": [31, 237, 168, 1], "stroke-width": 2 };
        return {
          "stroke-color": color || defaultLineStrokeColor,
          "stroke-width": 2
        };
      case mGeometryTypes.Polygon:
      case mGeometryTypes.MultiPolygon:
        return {
          // 23Feb2025  "fill-color": [78, 134, 241, 0.7],
          // 23Feb2025 "stroke-color": [31, 102, 237, 0.5],
          "fill-color": color
            ? [...color.slice(0, 3), 0.7]
            : defaultPolygonFillColor,
          "stroke-color": color
            ? [...color.slice(0, 3), 0.5]
            : defaultPolygonStrokeColor,
          "stroke-width": 1
        };
      default:
        return {
          "fill-color": [104, 78, 241, 0.6],
          "stroke-color": [241, 104, 78, 0.6],
          "stroke-width": 1,
          "circle-radius": 5,
          "circle-fill-color": [104, 78, 241, 1]
        };
    }
  }

  // 18Feb2025
  function addVectorLayer(config) {
    //  check if the layer already exists in the map layers
    if (getLayerByTitle(config.LayerName)) {
      publicAPI.removeLayer(config.LayerName);
    }

    // ? convert the map features to OpenLayers features; Parse WKB geometries and create features;  end-to-end binary pipeline  // 05Feb2025
    let geometry;
    let feature;

    const olFeatures = config.MapFeatures.map((row, index) => {
      try {
        geometry = new WKB().readGeometry(row.wkb); // Parse binary WKB into OpenLayers geometry

        feature = new Feature();
        feature.setGeometry(geometry);
        // Create an object of properties
        const properties = Object.keys(row).reduce((obj, key) => {
          if (key !== "wkb" && key !== "geometry") {
            obj[key] = row[key];
          }
          return obj;
        }, {});

        // Add 'id' property
        feature.setId(`feature_${index}`);

        // Set all properties at once
        feature.setProperties(properties);
      } catch (error) {
        console.error(`Error creating feature:`, error);
        console.log("Row data:", JSON.stringify(row, null, 2));
        return null;
      }
      return feature;
    }).filter((feature) => feature !== null); // Remove any null features

    const vectorLyrSource = new VectorSource({
      features: olFeatures // 05Feb2025
    });
    const vectorLyr = new VectorLayer({
      title: config.LayerName,
      source: vectorLyrSource,
      minZoom: 3,
      maxZoom: 23,
      // 23Feb2025 style: styleFunction
      style: function (feature) {
        return styleFunction(
          feature,
          config.CategoryColumn,
          config.CategoryColors
        );
      }
    });
    mMapLayers.push(vectorLyr);
    mMap.addLayer(vectorLyr);
    mMap.setLayers(mMapLayers);
    mActiveMapVectorLyr = vectorLyr;
    mActiveMapLyrName = config.LayerName;

    // ? fit to map extent
    const layerExtent = vectorLyrSource.getExtent(); // ? get layer extent
    mMapView.fit(layerExtent, {
      size: mMap.getSize()
    });
    mMap.render();
    updateLayerControl();
  }

  /*  // ? This works,  17Feb2025
  function incrementalFeatureLoader(features, vectorSource, delay = 10) {
    const totalFeatures = features.length;
    const batchSize = Math.ceil(totalFeatures / 6); // Calculate batchSize to always have 6 batches
    let index = 0;
    let skippedFeatures = 0;
    let errorLog = [];

    function loadBatch() {
      const end = Math.min(index + batchSize, totalFeatures);
      const batch = features.slice(index, end);

      batch.forEach((feature, i) => {
        try {
          vectorSource.addFeature(feature);
        } catch (error) {
          skippedFeatures++;
          errorLog.push({
            featureIndex: index + i,
            error: error.message,
            featureProperties: feature.getProperties()
          });
          console.warn(
            `Error adding feature at index ${index + i}:`,
            error.message
          );
        }
      });

      index = end;

      if (index < totalFeatures) {
        setTimeout(loadBatch, delay);
      } else {
        // All features processed
        finishLoading();
      }
    }

    function finishLoading() {
      console.log(
        `Loading complete. ${skippedFeatures} features skipped due to errors.`
      );
      if (errorLog.length > 0) {
        console.log("Detailed error log:", errorLog);
      }

      // Fit the map to the extent of successfully loaded features
      const layerExtent = vectorSource.getExtent();
      if (layerExtent) {
        mMapView.fit(layerExtent, {
          size: mMap.getSize(),
          duration: 1000 // Animate over 1 second
        });
      } else {
        console.warn("No valid extent found for the layer.");
      }
      mMap.render();
    }

    loadBatch();
  } */

  // 17Feb2025
  function adaptiveBatchLoader(features, vectorSource) {
    const totalFeatures = features.length;
    const targetLoadTime = 2000; // 2 seconds in milliseconds
    const minBatchSize = 100;
    const maxBatchSize = 100000;

    let batchSize, initialBatchSize;
    let index = 0;
    let skippedFeatures = 0;
    let errorLog = [];
    let totalLoadTime = 0;
    let batchesLoaded = 0;

    // Function to estimate initial batch size
    function estimateInitialBatchSize() {
      if (totalFeatures <= 10000) return 5000;
      if (totalFeatures <= 100000) return 10000;
      if (totalFeatures <= 1000000) return 20000;
      return 50000;
    }

    initialBatchSize = estimateInitialBatchSize();
    batchSize = initialBatchSize;

    function loadBatch() {
      const startTime = performance.now();
      const end = Math.min(index + batchSize, totalFeatures);
      const batch = features.slice(index, end);

      batch.forEach((feature, i) => {
        try {
          vectorSource.addFeature(feature);
        } catch (error) {
          skippedFeatures++;
          errorLog.push({
            featureIndex: index + i,
            error: error.message,
            featureProperties: feature.getProperties()
          });
        }
      });

      index = end;
      const batchTime = performance.now() - startTime;
      totalLoadTime += batchTime;
      batchesLoaded++;

      // Adjust batch size to target 2 seconds per batch
      if (batchesLoaded <= 3) {
        // Only adjust in the first few batches
        const timePerFeature = batchTime / batchSize;
        batchSize = Math.floor(targetLoadTime / timePerFeature);
        batchSize = Math.max(Math.min(batchSize, maxBatchSize), minBatchSize);
      }

      // Update progress
      const progress = (index / totalFeatures) * 100;
      console.log(`Loading progress: ${progress.toFixed(2)}%`);

      if (index < totalFeatures) {
        requestAnimationFrame(loadBatch);
      } else {
        finishLoading();
      }
    }

    function finishLoading() {
      console.log(
        `Loading complete. ${skippedFeatures} features skipped due to errors.`
      );
      console.log(`Total load time: ${totalLoadTime / 1000} seconds`);
      if (errorLog.length > 0) {
        console.log("Detailed error log:", errorLog);
      }

      const layerExtent = vectorSource.getExtent();
      if (layerExtent) {
        mMapView.fit(layerExtent, {
          size: mMap.getSize(),
          duration: 1000
        });
      } else {
        console.warn("No valid extent found for the layer.");
      }
      mMap.render();
    }

    loadBatch();
  }

  // 18Feb2025
  function addWebGLVectorLayer(config) {
    //  check if the layer already exists in the map layers
    if (getLayerByTitle(config.LayerName)) {
      publicAPI.removeLayer(config.LayerName);
    }

    // ? convert the map features to OpenLayers features; Parse WKB geometries and create features;  end-to-end binary pipeline  // 05Feb2025
    let geometry;
    let feature;

    const olFeatures = config.MapFeatures.map((row, index) => {
      try {
        geometry = new WKB().readGeometry(row.wkb); // Parse binary WKB into OpenLayers geometry

        feature = new Feature();
        feature.setGeometry(geometry);
        // Create an object of properties
        const properties = Object.keys(row).reduce((obj, key) => {
          if (key !== "wkb" && key !== "geometry") {
            obj[key] = row[key];
          }
          return obj;
        }, {});

        // Add 'id' property
        feature.setId(`feature_${index}`);

        // Set all properties at once
        feature.setProperties(properties);
      } catch (error) {
        console.error(`Error creating feature:`, error);
        console.log("Row data:", JSON.stringify(row, null, 2));
        return null;
      }
      return feature;
    }).filter((feature) => feature !== null); // Remove any null features

    const vectorLyrSource = new VectorSource();
    // 23Feb2025 const styleObj = getWebGLStyleProperties(config.GeometryType); // 13Feb2025
    const vectorLyr = new WebGLVectorLayer({
      title: config.LayerName,
      source: vectorLyrSource,
      minZoom: 3,
      maxZoom: 23,
      // 23Feb2025 style: styleObj // 13Feb2025
      style: function (feature) {
        return getWebGLStyleProperties(
          feature,
          config.CategoryColumn,
          config.CategoryColors
        );
      }
    });
    mMapLayers.push(vectorLyr);
    mMap.addLayer(vectorLyr);
    mMap.setLayers(mMapLayers);
    mActiveMapVectorLyr = vectorLyr;
    mActiveMapLyrName = config.LayerName;

    // Use the incremental loader instead of adding all features at once
    // ? This works,  // 17Feb2025 incrementalFeatureLoader(olFeatures, vectorLyrSource);
    adaptiveBatchLoader(olFeatures, vectorLyrSource); // 17Feb2025
    updateLayerControl();
  }

  // 17Feb2025
  publicAPI.addMapLayer = function (config) {
    // ? The OpenLayers WebGLVectorLayer seems to be unstable. For unknown reasons,
    // ? it throws a range error in the styling function when loading less number of features like usa counties (~ 3335)
    // ? so I decided to use the regular VectorLayer for features <= 5000 and use the
    // ? WebGLVectorLayer for features > 5000.  // 18Feb2025
    if (config.MapFeatures.length > 5000) {
      addWebGLVectorLayer(config);
    }
    addVectorLayer(config);
  };

  // ? Add XYZ Layer 19Jan2025
  publicAPI.addTileLayer = function (lyrSource, layerName) {
    //  check if the layer already exists in the map layers
    if (getLayerByTitle(layerName)) {
      publicAPI.removeLayer(layerName);
    }

    const lyr = new TileLayer({ source: lyrSource, title: layerName });
    // 25Jan2025 mMapLayers.push(lyr);
    const insertIndex = 2; // ? index = 0 is reserved for Satellite Layer and index = 1 is reserved for OSM Base map; // 25Jan2025
    mMapLayers.splice(insertIndex, 0, lyr); // ? add the layer below all 'business' layers  // 25Jan2025

    mMap.addLayer(lyr);
    mMap.setLayers(mMapLayers);
    mMap.render();
    updateLayerControl();
  };

  publicAPI.removeLayer = function (layerName) {
    mMap
      .getLayers()
      .getArray()
      .forEach((layer) => {
        if (layer.get("title") === layerName) {
          mMap.removeLayer(layer);
        }
      });

    // remove this layer from mMapLayers array
    mMapLayers = mMapLayers.filter((layer) => layer.get("title") !== layerName);
    mMap.setLayers(mMapLayers);
    mMap.render();

    if (layerName === mActiveMapLyrName) {
      mActiveMapLyrName = null;
      // 28Jan2025 mMediator.broadcast("MapLayerRemovedFromResultsMapEvent");
    }

    updateLayerControl();
  };

  publicAPI.toggleLayer = function (layerName) {
    mMap
      .getLayers()
      .getArray()
      .forEach((layer) => {
        if (layer.get("title") === layerName) {
          layer.setVisible(!layer.getVisible());
        }
      });
    updateLayerControl();
  };

  // 30Aug2024
  publicAPI.clearMap = function (layerName) {
    const vectorLyr = getLayerByTitle(layerName);
    vectorLyr.getSource().clear();
  };

  publicAPI.updateSize = function () {
    mMap.updateSize();
  };

  publicAPI.init = function (config) {
    mConfig = config;
    createMap();
    // ? Initial call to create layer controls
    updateLayerControl();
    addMapZoomResetBtn();
    addEventListeners();
  };

  return publicAPI;
}
export default OLMap;
