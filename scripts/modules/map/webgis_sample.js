import $ from "jquery";
// 15Apr2024import popper from "popper.js";
// 15Apr2024 import bootstrap from "bootstrap";
import bootstrap from "bootstrap/dist/js/bootstrap";
// 15Apr2024 import Handlebars from "Handlebars";
import Handlebars, { W } from "handlebars/dist/handlebars"; // 15Apr2024
import * as duckdb from "@duckdb/duckdb-wasm";
import { load } from "@loaders.gl/core";
import { _GeoJSONLoader } from "@loaders.gl/json";
import * as d3 from "d3";
import HelperUtil from "./modules/helperutils";
// 14Jun2025 import RemoteDatasetTemplateHTML from "./HTMLTemplates/RemoteDataset.html";
import DatasetTemplateHTML from "./HTMLTemplates/Dataset.html";
import WorkflowTemplateHTML from "./HTMLTemplates/Workflow.html";
import WorkflowStepTemplateHTML from "./HTMLTemplates/WorkflowStep.html"; // 23Jul2024
import BlockDatasetTemplateHTML from "./HTMLTemplates/BlockDataset.html";
import SelectQueryTemplateHTML from "./HTMLTemplates/SelectQuery.html";
import WorkflowPreviewContentTemplateHTML from "./HTMLTemplates/WorkflowPreviewContent.html"; // 18Sep2024
// import DataSourceItemTemplateHTML from "./HTMLTemplates/DataSourceItem.html"; // 09Jun2025 - Removed
import DisplayTable from "./modules/simpledatatable";
import Mediator from "./modules/mediator"; // 27Jan2025
import LogicFindBlock from "./modules/blocks/logic/logic_find_block"; // 10Aug2024
import LogicWhereBlock from "./modules/blocks/logic/logic_where_block"; // 13Aug2024
import LogicComparisonBlock from "./modules/blocks/logic/logic_comparison_block"; // 18Aug2024
import LogicAndOrBlock from "./modules/blocks/logic/logic_andor_block.js"; // 18Aug2024
import LogicBetweenBlock from "./modules/blocks/logic/logic_between_block"; // 18Aug2024
import LogicInLikeBlock from "./modules/blocks/logic/logic_inlike_block"; // 19Aug2024
import LogicIsNullBlock from "./modules/blocks/logic/logic_isnull_block"; // 19Aug2024
import LogicOrderByBlock from "./modules/blocks/logic/logic_orderby_block"; // 22Aug2024
// 07Jun2025 import LogicDataCombineBlock from "./modules/blocks/logic/logic_data_combine_block_deprecated.js"; // 09Feb2025
import AggregationFindBlock from "./modules/blocks/aggregation/aggregation_find_block"; // 19Aug2024
// 08Jun2025 import AggregationWhereBlock from "./modules/blocks/aggregation/aggregation_where_block"; // 21Aug2024
// 08Jun2025 import AggregationComparisonBlock from "./modules/blocks/aggregation/aggregation_comparison_block"; // 21Aug2024
// 08Jun2025 import AggregationAndOrBlock from "./modules/blocks/aggregation/aggregation_andor_block"; // 22Aug2024
// 08Jun2025 import AggregationInLikeBlock from "./modules/blocks/aggregation/aggregation_inlike_block"; // 22Aug2024
// 08Jun2025 import AggregationIsNullBlock from "./modules/blocks/aggregation/aggregation_isnull_block"; // 22Aug2024
// 08Jun2025 import AggregationBetweenBlock from "./modules/blocks/aggregation/aggregation_between_block"; // 22Aug2024
import AggregationFindGroupByBlock from "./modules/blocks/aggregation/aggregation_find_groupby_block"; // 23Aug2024
// 08Jun2025 import AggregationOrderByBlock from "./modules/blocks/aggregation/aggregation_orderby_block"; // 23Aug2024
import AggregationDataCategorizeBlock from "./modules/blocks/aggregation/aggregation_data_categorize_block"; // 13Feb2025
import AggregationDataCombineBlock from "./modules/blocks/aggregation/aggregation_data_combine_block"; // 07Jun2025
import SpatialWhereBlock from "./modules/blocks/spatial/spatial_where_block";
import SpatialFindJoinBlock from "./modules/blocks/spatial/spatial_find_join_block";
import SpatialFindBufferBlock from "./modules/blocks/spatial/spatial_find_buffer_block"; // 25Aug2024
import SpatialFindWithinDistanceFromPointBlock from "./modules/blocks/spatial/spatial_find_withindistance_frompoint_block"; // 26Aug2024
import SpatialComparisonBlock from "./modules/blocks/spatial/spatial_comparison_block"; // 06Sep2024
// 08Jun2025 import SpatialAndOrBlock from "./modules/blocks/spatial/spatial_andor_block"; // 06Sep2024
import SpatialInLikeBlock from "./modules/blocks/spatial/spatial_inlike_block"; // 07Sep2024
import SpatialIsNullBlock from "./modules/blocks/spatial/spatial_isnull_block"; // 08Sep2024
import SpatialBetweenBlock from "./modules/blocks/spatial/spatial_between_block"; // 08Sep2024
import SpatialOrderByNumberBlock from "./modules/blocks/spatial/spatial_orderbynumber_block"; // 11Dec2024
import VizMapCategoriesValueBlock from "./modules/blocks/viz/viz_map_categories_value_block.js"; // 14Feb2025
import ResultsMap from "./modules/resultsmap.js"; // 20Jan2025
import PreviewMap from "./modules/previewmap.js"; // 27Jan2025
import * as Blockly from "blockly/core";

import * as libraryBlocks from "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import * as En from "blockly/msg/en";
import DataCatalogCardTemplateHTML from "./HTMLTemplates/DataCatalogCard.html"; // Added for Data Catalog // 15Jun2025
// import HuggingfaceFoursquarePlacesModule from './modules/datacatalog_js/huggingface_foursquare_places.js'; // 16Jun2025
const htmlCache = {}; // Cache for loaded HTML templates
const jsCache = {}; // Cache for loaded JS modules

// TODO: Explore jsonGenerator for blocks  // 22Feb2025

function WebGIS() {
  // eslint-disable-line no-unused-vars
  const publicAPI = {};
  let mDB;
  let mDBConn;
  let mMediator;
  let mHelperUtil;
  let mDatasetList = [];
  let mDatasetPreviewTablesList = [];
  let mMapView;
  let mResultsMap;
  let mPreviewMap;
  let mMapLayers;
  let mMapContainerID;
  let mBlocklyWorkspace; // 02May2024
  let mBlocklyToolboxContents; // 03May2024
  let mWhereComparisonBlock; // 17May2024
  let mFindSpatialBlock; // 17May2024
  let mSerializedWorkspaceJSONString; // 20May2024
  let mWorkflowsList = []; // 16Jul2024
  let mEditWorkflowID; // 22Jul2024
  let mEditWorkflowStepID; // 22Sep2024
  let mResultsVizView = "Map"; //? values: Map, DataTable
  let mPreviewVizView = "Map"; // ? values: Map, DataTable
  let mResultsTable; // 30Aug2024
  let mPreviewDataset; // 30Aug2024
  let mPreviewDataQueryTableName = "tblPreviewData"; // 31Aug2024
  let mEditWorkflowFlag = false; // 19Sep2024
  const mMainBlocklyWorkspaceElemID = "divMainBlocklyWorkspace"; // 22Sep2024
  let mCurrentViewData; // 20Feb2025
  let mDataCatalogItems; // 17Jun2025

  const mNYCStreetsDataURL =
    "http://localhost/WebGISApp/data/nyc_streets.parquet";
  const mNYCNeighborhoodsDataURL =
    "http://localhost/WebGISApp/data/nyc_neighborhoods.parquet";
  const mNYCCensusBlocksDataURL =
    "http://localhost/WebGISApp/data/nyc_census_blocks.parquet";
  const mNYCSubwayStationsDataURL =
    "http://localhost/WebGISApp/data/nyc_subway_stations.parquet";

  const mGeometryTypes = {
    Point: "POINT",
    MultiPoint: "MULTIPOINT",
    Polygon: "POLYGON",
    Multipolygon: "MULTIPOLYGON",
    Line: "LINESTRING",
    MultiLine: "MULTILINESTRING",
    Unknown: "UNKNOWN",
  };

  const mUrlTypes = {
    File: "file",
    WebApi: "webapi",
    Binary: "binary",
  };

  // 21May2024
  const mDatasetOriginTypes = {
    // 02Feb2025 External: "External",
    Remote: "Remote", // 02Feb2025
    Local: "Local", // 02Feb2025
    Block: "Block",
    Workflow: "Workflow",
    WorkflowStep: "WorkflowStep",
  };

  // 19Feb2025
  const mBlockTypes = {
    Aggregation: "AGGREGATION",
    Logic: "LOGIC",
    Spatial: "SPATIAL",
    Viz: "VIZ",
  };

  publicAPI.setMediator = function (m) {
    mMediator = m;
  };
  publicAPI.getMediator = function () {
    return mMediator;
  };

  const mClickEventHandlers = {
    "#btnSaveRemoteDataset": handleSaveRemoteDatasetClickEvent,
    "#btnSaveLocalDataset": handleSaveLocalDatasetClickEvent, // 14Jun2025
    "#btnSaveBlockDataset": handleSaveBlockAsDatasetClickEventNew1, // 23Feb2025 handleSaveBlockAsDatasetClickEventNew, // 11Feb2025 handleSaveBlockAsDatasetClickEvent, // 19May2024
    "#btnSaveWorkflow": handleSaveWorkflowClickEvent, // 19May2024
    "#btnLoadWorkflowConfig": handleLoadWorkflowConfigClickEvent, // 08Mar2025
    "[rel=js-Generate-Workflow-Config]": handleGenerateWorkflowConfigClickEvent, // 08Mar2025
    "[rel=js-Delete-Workflow]": handleDeleteWorkflowClickEvent, // 10Mar2025
    "#btnSaveWorkflowStep": handleSaveWorkflowStepClickEventNew1, // 21Feb2025 handleSaveWorkflowStepClickEventNew, // 11Feb2025 handleSaveWorkflowStepClickEvent, // 22Jul2024,
    "[rel=js-save-edit-workflow-step]": handleSaveWorkflowStepEditsClickEvent, // 04Oct2024
    "[rel=js-addtomap-dataset],[rel=js-workflow-step-addtomap-dataset]":
      handleAddDatasetToResultsViewClickEventNew, // 23Jan2025
    // ? Dataset Preview - BEGIN
    "[rel=js-preview-dataset]": handleDatasetPreviewClickEvent,
    "[rel=js-preview-workflow-step]": handleWorkflowStepPreviewClickEvent, // 24Jul2024
    "[rel=js-Preview-Workflow]": handleWorkflowPreviewClickEvent, // 18Sep2024
    // ? Dataset Preview - END
    "[rel=js-delete-dataset]": handleDeleteDatasetClickEvent,
    "a[rel=js-query-select]": handleQuerySelectClickEvent,
    "[rel=js-dataset-chkbx]": handleDatasetCheckboxClickEvent,
    "#btnExecuteBlock": handleExecuteBlockCodeClickEvent,
    "[rel=js-Edit-Workflow]": handleStartEditWorkflowClickEvent, // 19Jul2024
    "[rel=js-StopEdit-Workflow]": handleStopEditWorkflowClickEvent, // 22Jul2024
    "#radBtnResultsMap": handleResultsMapRadioButtonClickEvent, // 16Aug2024
    "#radBtnResultsDataTable": handleResultsTableRadioButtonClickEventNew, // 24Feb2025 handleResultsTableRadioButtonClickEvent, // 16Aug2024
    "#radBtnPreviewMap": handlePreviewMapRadioButtonClickEvent, // 31Aug2024
    "#radBtnPreviewDataTable": handlePreviewTableRadioButtonClickEvent, // 31Aug2024
    ".panel-header": handleBlocklyWorkspacePanelHeaderClickEvent,
    "#btnClearResultsTable": handleClearResutlsTableButtonClickEvent, // 30Aug2024
    "button[rel=js-edit-workflow-step]": handleStartWorkflowStepEditClickEvent, // 22Sep2024
    "#btnLoadDataCatalogFromDb": handleLoadDatacatalogFromDbClickEvent,
  };

  const mQueryList = [
    {
      ID: "q1",
      Question: "What are all the neighborhoods served by the 6-train?",
      SQL: "SELECT DISTINCT n.name, n.boroname </br> FROM nyc_subway_stations AS s <br> JOIN nyc_neighborhoods AS n </br> ON ST_Contains(n.geom, s.geom) </br> WHERE strpos(s.routes,'6') > 0;",
      ReturnType: "map",
    },
    {
      ID: "q2",
      Question:
        "What is the population and racial make-up of the neighborhoods of Manhattan?",
      SQL: "SELECT  neighborhoods.name AS neighborhood_name,<br>Sum(census.popn_total) AS population,<br>100.0 * Sum(census.popn_white) / Sum(census.popn_total) AS white_pct,<br>100.0 * Sum(census.popn_black) / Sum(census.popn_total) AS black_pct<br>FROM nyc_neighborhoods AS neighborhoods<br>JOIN nyc_census_blocks AS census<br>ON ST_Intersects(neighborhoods.geom, census.geom)<br>WHERE neighborhoods.boroname = 'Manhattan'<br>GROUP BY neighborhoods.name<br>ORDER BY white_pct DESC;",
      ReturnType: "table",
    },
  ];

  // 18Oct2024
  function displayLoadingIcon(iconID) {
    $("#" + iconID).removeClass("d-none");
  }

  // 18Oct2024
  function hideLoadingIcon(iconID) {
    $("#" + iconID).addClass("d-none");
  }

  // 15Jun2025
  async function handleLoadDatacatalogFromDbClickEvent() {
    // Renamed in your provided code
    const fileInput = document.getElementById("dataCatalogDbFile");
    const file = fileInput.files[0];

    if (!file) {
      displayAlert("Please select a .duckdb file first.");
      return;
    }

    $("#divDataCatalogLoading").removeClass("d-none");
    $("#dataCatalogCardsContainer").empty().addClass("d-none"); // Clear previous cards and hide
    $("#dataCatalogPlaceholder").addClass("d-none");

    let catalogDbConn = null;
    try {
      const buffer = await file.arrayBuffer();
      await mDB.registerFileBuffer(file.name, new Uint8Array(buffer));

      catalogDbConn = await mDB.connect(); // Use main mDB to connect to the registered file

      // Attach the database file with an alias
      const dbAlias = "user_catalog_db";
      await catalogDbConn.query(
        `ATTACH '${file.name}' AS ${dbAlias} (READ_ONLY);`
      );

      // Query the catalog_items table (adjust table and column names if necessary)
      const catalogQuery = `
        SELECT ID, Name, Description, URL, Keywords, Provider, Category, License, Format, UpdateFrequency, Region, HTMLFile, JSModule 
        FROM ${dbAlias}.data_catalog;
      `;
      const result = await catalogDbConn.query(catalogQuery);
      mDataCatalogItems = result.toArray().map(Object.fromEntries);

      $("#dataCatalogCardsContainer").removeClass("d-none"); // Show container before adding cards
      if (mDataCatalogItems.length === 0) {
        $("#dataCatalogCardsContainer").html(
          '<div class="col-12 text-center text-muted py-5"><p><i class="bi bi-exclamation-triangle fs-1"></i></p><h4>No Items Found</h4><p>The table "data_catalog" in the selected .duckdb file is empty or does not exist.</p></div>'
        );
      } else {
        const dataCatalogCardTemplate = Handlebars.compile(
          DataCatalogCardTemplateHTML
        ); // Ensure DataCatalogCardTemplateHTML is imported
        mDataCatalogItems.forEach((item) => {
          const cardHtml = dataCatalogCardTemplate(item);
          $("#dataCatalogCardsContainer").append(cardHtml);
        });
      }

      // Detach the database
      await catalogDbConn.query(`DETACH ${dbAlias};`);
    } catch (error) {
      console.error("Error loading data catalog:", error);
      displayAlert(`Error loading data catalog: ${error.message}`);
      $("#dataCatalogCardsContainer")
        .removeClass("d-none")
        .html(
          `<div class="col-12 text-center text-danger py-5"><p><i class="bi bi-x-octagon-fill fs-1"></i></p><h4>Error Loading Catalog</h4><p>${error.message}</p></div>`
        );
    } finally {
      if (catalogDbConn) {
        await catalogDbConn.close();
      }
      await mDB.dropFile(file.name); // Clean up the registered file
      $("#divDataCatalogLoading").addClass("d-none");
      // fileInput.value = ""; // Reset file input // Commented out as per previous diffs
    }
  }

  // 15Jun2025
  function handleDataCatalogSearch() {
    const searchTerm = $("#dataCatalogSearchInput").val().toLowerCase().trim();
    let visibleCount = 0;
    const $cards = $("#dataCatalogCardsContainer .data-catalog-card");

    // If no cards are loaded yet, but the user is searching, don't show "no results".
    if ($cards.length === 0 && searchTerm) {
      $("#dataCatalogNoResults").addClass("d-none");
      return;
    }

    $cards.each(function () {
      const card = $(this);
      // Ensure data attributes are treated as strings and lowercased
      const name = (String(card.data("name")) || "").toLowerCase();
      const description = (
        String(card.data("description")) || ""
      ).toLowerCase();
      const keywords = (String(card.data("keywords")) || "").toLowerCase(); // Helper already lowercases and joins

      let match = false;
      if (searchTerm === "") {
        // If search term is empty, show all cards
        match = true;
      } else {
        // Prioritized search: Keywords -> Description -> Name
        if (keywords.includes(searchTerm)) {
          match = true;
        } else if (description.includes(searchTerm)) {
          match = true;
        } else if (name.includes(searchTerm)) {
          match = true;
        }
      }

      if (match) {
        card.removeClass("d-none");
        visibleCount++;
      } else {
        card.addClass("d-none");
      }
    });

    $("#dataCatalogNoResults").toggleClass(
      "d-none",
      !(visibleCount === 0 && searchTerm !== "")
    );
  }

  // 21Aug2024
  function displayToastAlert(msg) {
    const toastElement = document.getElementById("divToastContainer");
    const toastMsgElem = document.getElementById("divToastText");
    toastMsgElem.textContent = msg;
    const toast = new bootstrap.Toast(toastElement, {
      animation: true,
      autohide: true,
      delay: 10000, // 10 seconds
    });
    toast.show();
  }

  // 12Jul2024
  function createFittedWorkspace(container, options = {}) {
    // Set default options
    const defaultOptions = {
      scrollbars: true,
      readOnly: true,
      zoom: {
        controls: false,
        wheel: false,
        startScale: 0.9,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: false,
    };

    //? Merge default options with user-provided options
    const mergedOptions = { ...defaultOptions, ...options };

    // ?Create a new workspace
    const workspace = Blockly.inject(container, mergedOptions);

    // 07Sep2024
    //? Function to resize the workspace
    const resizeWorkspace = function () {
      // ?Get the bounding box of all blocks in the workspace
      const metrics = workspace.getMetrics();
      const contentHeight = metrics.contentHeight + 30; // ? add a buffer height
      const contentWidth = metrics.contentWidth + 30;

      $("#" + container).height(`${contentHeight}px`);
      $("#" + container).width(`${contentWidth}px`);

      Blockly.svgResize(workspace);
      // workspace.zoomToFit();
    };

    // Add a change listener to resize when blocks are added or removed
    workspace.addChangeListener((event) => {
      if (
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE ||
        event.type === Blockly.Events.FINISHED_LOADING
      ) {
        resizeWorkspace();
      }
    });

    window.addEventListener("resize", resizeWorkspace, false);
    // Initial resize
    resizeWorkspace();

    return workspace;
  }

  // 18Sep2024
  function handleCloseWorkflowPreviewModalEvent() {
    const modalEl = document.getElementById("divWorkflowPreviewPanel");

    /* // ? 11Mar2025, Keep the workflow steps datasets, to enable preview without Workflow Edit mode ON.
    
     // 19Sep2024
    if (!mEditWorkflowFlag) {
      // ? remove workflow step datasets from global dataset list
      const workflowIDElem = $("[rel=js-workflow-content]").attr("id");
      const workflowID = workflowIDElem.split("_")[1];

      removeWorkflowStepsDatasets(workflowID); // 19Sep2024
      updateBlocks();
    } */

    $("#divWorkflowPreviewContent").empty();

    modalEl.removeEventListener(
      "hide.bs.modal",
      handleCloseWorkflowPreviewModalEvent
    );
  }

  // 18Sep2024
  function displayWorkflowPreview(workflowID) {
    const modalEl = document.getElementById("divWorkflowPreviewPanel");
    const modal = new bootstrap.Modal(modalEl);

    const workflow = mWorkflowsList.find(function (d) {
      return d.ID === workflowID;
    });

    let WorkflowStepsList = [];
    let workflowStep;
    const workflowSteps = workflow.Steps;

    /*  // 11Mar2025
   //  let workflowStepsBlockDatasetList;
    if (!mEditWorkflowFlag) {
      // ? add Step Block Dataset to global dataset list
      workflowStepsBlockDatasetList = workflowSteps.map(function (d) {
        return d.BlockDataset;
      });
      mDatasetList = mDatasetList.concat(workflowStepsBlockDatasetList);
      updateBlocks();
    } */

    workflowSteps.forEach(function (step) {
      workflowStep = {
        WorkflowID: workflowID,
        WorkflowStepID: step.ID,
        WorkflowStepName: step.Name,
        WorkflowStepNumber: step.Number, // 12Feb2025
        WorkflowStepDescription: step.Description,
        IsStepNumberGTOne: step.Number > 1,
        SerializedWorkspaceJSON: step.BlockDataset.SerializedWorkspaceJSON,
      };
      WorkflowStepsList.push(workflowStep);
    });

    const config = {
      WorkflowID: workflowID,
      WorkflowStepsList: WorkflowStepsList,
    };

    const workflowPreviewCompiledTemplateHTML = Handlebars.compile(
      WorkflowPreviewContentTemplateHTML
    );
    const workflowPreviewContentGeneratedHTML =
      workflowPreviewCompiledTemplateHTML(config);

    $("#divWorkflowPreviewContent").append(workflowPreviewContentGeneratedHTML);

    // ? create and load workspace JSON
    WorkflowStepsList.forEach(async function (step) {
      await loadAndRenderWorkspace(
        step.SerializedWorkspaceJSON,
        `workspace_${step.WorkflowStepID}`
      );
    });

    modalEl.addEventListener(
      "hide.bs.modal",
      handleCloseWorkflowPreviewModalEvent
    );
    modal.show();
  }

  // 18Sep2024
  function handleWorkflowPreviewClickEvent(evt) {
    const elemID = $(evt.currentTarget).attr("id");
    const workflowID = elemID.split("_")[1];
    displayWorkflowPreview(workflowID);
  }

  function addWorkflowToPanel(workflow) {
    const workflowCompiledTemplateHTML =
      Handlebars.compile(WorkflowTemplateHTML);
    const workflowGeneratedHTML = workflowCompiledTemplateHTML(workflow);
    $("#divWorkflows").append(workflowGeneratedHTML);
  }

  // 22Aug2024
  function handleBlocklyWorkspacePanelHeaderClickEvent() {
    const panelHeader = document.querySelector(".panel-header");
    const panelContent = document.querySelector(".panel-content");

    if (panelContent.style.display === "block") {
      panelContent.style.display = "none";
    } else {
      panelContent.style.display = "block";
      // createFittedWorkspace("divMainBlocklyWorkspace");
    }
  }

  // 10Mar2025
  function deleteWorkflow(workflowId) {
    // Show confirmation dialog
    if (
      confirm(
        "Are you sure you want to delete this workflow? This action cannot be undone."
      )
    ) {
      // Remove the workflow from the DOM
      $(`#wf_${workflowId}`).remove();

      // Remove the workflow from the mWorkflowsList array
      mWorkflowsList = mWorkflowsList.filter(
        (workflow) => workflow.ID !== workflowId
      );

      // Optionally show a success message
      // showNotification("Workflow deleted successfully", "success");
      displayAlert("Workflow deleted successfully");
    }
  }

  // 10Mar2025
  function handleDeleteWorkflowClickEvent() {
    const workflowId = $(this).attr("id").replace("btnDeleteWorkflow_", "");
    deleteWorkflow(workflowId);
  }

  // 09Mar2025
  function handleLoadWorkflowConfigClickEvent() {
    // Create a file input element
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";

    // Create a modal for URL input option
    const modalHTML = `
    <div class="modal fade" id="loadConfigModal" tabindex="-1" aria-labelledby="loadConfigModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="loadConfigModalLabel">Load Workflow Configuration</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="configUrl" class="form-label">Enter URL to JSON configuration:</label>
              <input type="text" class="form-control" id="configUrl" placeholder="https://example.com/workflow-config.json">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="btnLoadFromUrl">Load from URL</button>
          </div>
        </div>
      </div>
    </div>
  `;

    // Append modal to body if it doesn't exist
    if (!document.getElementById("loadConfigModal")) {
      const modalContainer = document.createElement("div");
      modalContainer.innerHTML = modalHTML;
      document.body.appendChild(modalContainer);
    }

    // Show options dialog
    const optionsHTML = `
    <div class="modal fade" id="configSourceModal" tabindex="-1" aria-labelledby="configSourceModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="configSourceModalLabel">Select Configuration Source</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Choose how you want to load the workflow configuration:</p>
            <div class="d-grid gap-2">
              <button type="button" class="btn btn-primary" id="btnLocalFile">Load from Local File</button>
              <button type="button" class="btn btn-primary" id="btnRemoteUrl">Load from URL</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    // Append options modal to body if it doesn't exist
    if (!document.getElementById("configSourceModal")) {
      const optionsContainer = document.createElement("div");
      optionsContainer.innerHTML = optionsHTML;
      document.body.appendChild(optionsContainer);
    }

    // Show the options modal
    const optionsModal = new bootstrap.Modal(
      document.getElementById("configSourceModal")
    );
    optionsModal.show();

    // Handle local file option
    document
      .getElementById("btnLocalFile")
      .addEventListener("click", function () {
        optionsModal.hide();
        fileInput.click();
      });

    // Handle URL option
    document
      .getElementById("btnRemoteUrl")
      .addEventListener("click", function () {
        optionsModal.hide();
        const urlModal = new bootstrap.Modal(
          document.getElementById("loadConfigModal")
        );
        urlModal.show();
      });

    // Handle file selection
    fileInput.addEventListener("change", function (event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
          try {
            const configData = JSON.parse(e.target.result);
            displayLoadingIcon("divWorkflowLoadingIcon"); // 11Mar2025
            await processWorkflowConfig(configData);
            hideLoadingIcon("divWorkflowLoadingIcon"); // 11Mar2025
          } catch (error) {
            displayAlert("Error parsing configuration file: " + error.message);
          }
        };
        reader.readAsText(file);
      }
    });

    // Handle URL submission
    document
      .getElementById("btnLoadFromUrl")
      .addEventListener("click", function () {
        const url = document.getElementById("configUrl").value.trim();
        if (url) {
          fetch(url)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }
              return response.json();
            })
            .then((configData) => {
              const urlModal = bootstrap.Modal.getInstance(
                document.getElementById("loadConfigModal")
              );
              urlModal.hide();
              processWorkflowConfig(configData);
            })
            .catch((error) => {
              displayAlert(
                "Error loading configuration from URL: " + error.message
              );
            });
        } else {
          displayAlert("Please enter a valid URL");
        }
      });
  }

  // 09Mar2025
  async function processWorkflowConfig(configData) {
    try {
      // Validate the configuration data
      if (
        !configData ||
        !configData.Name ||
        !configData.Steps ||
        !Array.isArray(configData.Steps)
      ) {
        throw new Error("Invalid workflow configuration format");
      }

      // 1. Process and recreate datasources
      if (configData.Datasources && Array.isArray(configData.Datasources)) {
        const configDatasetIds = new Set(
          configData.Datasources.map((ds) => ds.ID)
        );

        // Remove existing datasets that are in the config
        mDatasetList = mDatasetList.filter(
          (ds) => !configDatasetIds.has(ds.ID)
        );

        // Add or update datasets from the config
        configData.Datasources.forEach((datasource) => {
          const existingDatasetIndex = mDatasetList.findIndex(
            (ds) => ds.ID === datasource.ID
          );
          if (existingDatasetIndex >= 0) {
            mDatasetList[existingDatasetIndex] = datasource; // Update
          } else {
            mDatasetList.push(datasource); // Add new
          }
        });

        // Refresh the datasources panel
        await refreshDatasourcesPanel();
      }

      // 2. Create the workflow
      // Check if workflow with same ID already exists and remove it
      let existingWorkflowIndex = mWorkflowsList.findIndex(
        (wf) => wf.ID === configData.ID
      );
      // If workflow exists, remove it from the list
      if (existingWorkflowIndex >= 0) {
        mWorkflowsList.splice(existingWorkflowIndex, 1);
      }

      // Create the workflow object
      const workflow = {
        ID: configData.ID || mHelperUtil.generateGUID(),
        Name: configData.Name,
        Description: configData.Description || "Imported workflow",
        Steps: [],
      };

      // Process each step
      if (configData.Steps && Array.isArray(configData.Steps)) {
        configData.Steps.forEach((stepConfig) => {
          const blockDataset = {
            ID: stepConfig.BlockDatasetID,
            Name: stepConfig.BlockDatasetName,
            Description: stepConfig.BlockDatasetDescription || "N/A", // 11Apr2025
            TableName: stepConfig.BlockDatasetTableName,
            Origin: stepConfig.BlockDatasetOrigin || "Workflow Step",
            DatasetType: stepConfig.BlockDatasetType || "BlockDataset",
            RecordCount: stepConfig.BlockDatasetRecordCount || 0,
            ColumnsList: stepConfig.BlockDatasetColumnsList || [],
            SelColumnsList: stepConfig.BlockDatasetSelColumnsList || [],
            SerializedWorkspaceJSON:
              stepConfig.BlockDatasetSerializedWorkspaceJSON || "N/A",
            SQLCode: stepConfig.BlockDatasetSQLCode || "N/A",
            HasGeometry: stepConfig.BlockDatasetHasGeometry || false,
            GeomColName: stepConfig.BlockDatasetGeomColName || null,
            GeometryType: stepConfig.BlockDatasetGeometryType || null,
            CRS: stepConfig.BlockDatasetCRS || "N/A",
            ShowBlockIcon: stepConfig.BlockDatasetShowBlockIcon || false,
            ShowLineIcon: stepConfig.BlockDatasetShowLineIcon || false,
            ShowPointIcon: stepConfig.BlockDatasetShowPointIcon || false,
            ShowPolygonIcon: stepConfig.BlockDatasetShowPolygonIcon || false,
            ShowTableIcon: stepConfig.BlockDatasetShowTableIcon || false,
            CategoryColors: stepConfig.BlockDatasetCategoryColors || null,
            CategoryColumn: stepConfig.BlockDatasetCategoryColumn || null,
          };

          // Create Step object
          const step = {
            ID: stepConfig.ID || mHelperUtil.generateGUID(),
            Name: stepConfig.Name,
            Description: stepConfig.Description || "",
            Number: stepConfig.Number || workflow.Steps.length + 1,
            BlockDataset: blockDataset,
          };

          workflow.Steps.push(step);
        });
      }

      mWorkflowsList.push(workflow);

      // 3. Clear and reload the workflow panel
      await refreshWorkflowPanel();
      // Show success message
      displayAlert(
        `Workflow '<strong>${workflow.Name}</strong>' loaded successfully!`
      );

      /*  // Update or add the workflow
      if (existingWorkflowIndex >= 0) {
        mWorkflowsList[existingWorkflowIndex] = workflow;
      } else {
        mWorkflowsList.push(workflow);
      } */
    } catch (error) {
      displayAlert("Error processing workflow configuration: " + error.message);
      console.error("Error processing workflow configuration:", error);
    }
  }

  /*  // 11Mar2025
  // 09Mar2025
  // Helper function to refresh the workflow panel
  function refreshWorkflowPanel() {
    // Clear existing workflows panel
    $("#divWorkflows").empty();

    // Reload workflows
    mWorkflowsList.forEach(function (workflow) {
      addWorkflowToPanel(workflow);

      $(function () {
        // Add workflow steps if any
        if (workflow.Steps && workflow.Steps.length > 0) {
          const workflowStepsContainer = $("#wf_" + workflow.ID).find(
            "#divWorkflowSteps"
          );
          workflowStepsContainer.empty();

          workflow.Steps.forEach(async function (step) {
            addWorkflowStepToWorkflowPanel(step, workflow.ID);
            // ? Run Block query Code
            let sqlCode = getSqlCode(step.BlockDataset.SQLCode);
            await mDBConn.query(sqlCode);
            // Check if step dataset already exists in mDatasetList
            const existingDatasetIndex = mDatasetList.findIndex(
              (ds) => ds.ID === step.BlockDataset.ID
            );
            if (existingDatasetIndex >= 0) {
              // Update existing dataset
              mDatasetList[existingDatasetIndex] = step.BlockDataset;
            } else {
              // Add new dataset
              mDatasetList.push(step.BlockDataset);
            }
            // 11Mar2025 updateBlocks();
          });
          updateBlocks();
        }
      });
    });
  } */

  // 11Mar2025
  // Helper function to refresh the workflow panel
  async function refreshWorkflowPanel() {
    // Clear existing workflows panel
    $("#divWorkflows").empty();

    // Reload workflows
    for (const workflow of mWorkflowsList) {
      addWorkflowToPanel(workflow);

      // Add workflow steps if any
      if (workflow.Steps && workflow.Steps.length > 0) {
        const workflowStepsContainer = $("#wf_" + workflow.ID).find(
          "#divWorkflowSteps"
        );
        workflowStepsContainer.empty();

        // Use for...of loop to handle async operations sequentially
        for (const step of workflow.Steps) {
          addWorkflowStepToWorkflowPanel(step, workflow.ID);
          // display text that is is loading this step in spanWorkflows
          const loadingText = `Loading Step:${step.Number}...</span>`;
          $("#spanWorkflows").html(loadingText);

          // ? Run Block query Code
          let sqlCode = getSqlCode(step.BlockDataset.SQLCode);
          await mDBConn.query(sqlCode);
          // Check if step dataset already exists in mDatasetList
          const existingDatasetIndex = mDatasetList.findIndex(
            (ds) => ds.ID === step.BlockDataset.ID
          );
          if (existingDatasetIndex >= 0) {
            // Update existing dataset
            mDatasetList[existingDatasetIndex] = step.BlockDataset;
          } else {
            // Add new dataset
            mDatasetList.push(step.BlockDataset);
          }
        }
        // Remove the loading text
        $("#spanWorkflows").empty(); // 11Mar2025
      }
    }

    // Call updateBlocks() once after all workflows and their steps have been processed
    updateBlocks();
  }

  // Helper function to refresh the datasources panel,  // 09Mar2025
  async function refreshDatasourcesPanel() {
    // Instead of clearing the panel, we'll check for existing datasets
    const existingDatasetElements = $("#divDatasets").children();

    // Create a map of existing dataset IDs in the DOM
    const existingDatasetIds = new Map();
    existingDatasetElements.each(function () {
      const datasetId = $(this).attr("id").split("_")[1];
      existingDatasetIds.set(datasetId, true);
    });

    // Process each dataset in mDatasetList
    const datasetsToAdd = mDatasetList.filter((dataset) => {
      return !(
        dataset.TableName &&
        dataset.TableName.startsWith("tbl_") &&
        existingDatasetIds.has(dataset.ID)
      );
    });

    await Promise.all(
      datasetsToAdd.map(async (dataset) => {
        if (dataset.Origin === mDatasetOriginTypes.Remote) {
          if (dataset.UrlType === mUrlTypes.File) {
            // display the text that it is loading this dataset in spanWorkflows
            const loadingText = `Loading ${dataset.Name}...</span>`;
            $("#spanWorkflows").html(loadingText);
            //")
            await createDatasetData(dataset);
            setDataTypeIcon(dataset, dataset.DatasetType);
            addDatasetToPanel(dataset);
          } else if (dataset.UrlType === mUrlTypes.WebApi) {
            // TODO:
            addDatasetToPanel(dataset);
          }
        }
      })
    );
    updateBlocks();
    // Remove loading text
    $("#spanWorkflows").empty(); // 11Mar2025
  }

  // 08Mar2025
  function handleGenerateWorkflowConfigClickEvent(evt) {
    // 11Mar2025 const workflowID = mEditWorkflowID;
    const elemID = $(evt.currentTarget).attr("id"); // 11Mar2025
    const workflowID = elemID.split("_")[1]; // 11Mar2025
    // get the workflow object from mWorkflowsList for this workflowID
    const workflow = mWorkflowsList.find(function (d) {
      return d.ID === workflowID;
    });

    // Get workflow configuration
    const workflowConfig = getWorkflowConfig(workflow);

    // Convert the configuration to JSON, handling BigInt values
    const configJSON = JSON.stringify(
      workflowConfig,
      (key, value) => {
        // Convert BigInt values to strings
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      },
      2
    );

    // Create a download link.
    const blob = new Blob([configJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workflowConfig.Name}_Config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 08Mar2025
  function getWorkflowConfig(workflow) {
    let workflowConfig;

    if (!workflow) {
      displayAlert("Error: Could not find the workflow!");
      return;
    }

    const workflowSteps = workflow.Steps.map(function (step) {
      return {
        ID: step.ID,
        Name: step.Name,
        Description: step.Description,
        Number: step.Number,
        BlockDatasetID: step.BlockDataset.ID,
        BlockDatasetName: step.BlockDataset.Name,
        BlockDatasetType: step.BlockDataset.DatasetType,
        BlockDatasetOrigin: step.BlockDataset.Origin,
        BlockDatasetDescription: step.BlockDataset.Description,
        BlockDatasetTableName: step.BlockDataset.TableName,
        BlockDatasetCRS: step.BlockDataset.CRS,
        BlockDatasetSerializedWorkspaceJSON:
          step.BlockDataset.SerializedWorkspaceJSON,
        BlockDatasetSQLCode: step.BlockDataset.SQLCode,
        BlockDatasetColumnsList: step.BlockDataset.ColumnsList,
        BlockDatasetSelColumnsList: step.BlockDataset.SelColumnsList,
        BlockDatasetRecordCount: step.BlockDataset.RecordCount,
        BlockDatasetHasGeometry: step.BlockDataset.HasGeometry,
        BlockDatasetGeometryType: step.BlockDataset.GeometryType,
        BlockDatasetGeomColName: step.BlockDataset.GeomColName || null,
        BlockDatasetCategoryColors: step.BlockDataset.CategoryColors || null,
        BlockDatasetCategoryColumn: step.BlockDataset.CategoryColumn || null,
        BlockDatasetShowBlockIcon: step.BlockDataset.ShowBlockIcon,
        BlockDatasetShowPointIcon: step.BlockDataset.ShowPointIcon,
        BlockDatasetShowPolygonIcon: step.BlockDataset.ShowPolygonIcon,
        BlockDatasetShowLineIcon: step.BlockDataset.ShowLineIcon,
        BlockDatasetShowTableIcon: step.BlockDataset.ShowTableIcon,
      };
    });

    // Collect all unique datasets used in the workflow steps
    // Filter out datasets with 'wfs' prefix in the name
    const datasourcesSet = new Set();

    // Check each step for referenced datasets in SQL code or other properties
    workflow.Steps.forEach((step) => {
      if (step.BlockDataset && step.BlockDataset.SQLCode) {
        // Extract table names from SQL code
        const sqlCode = step.BlockDataset.SQLCode;
        const tableMatches = sqlCode.match(/FROM\s+(\w+)|tbl_\w+/gi); // ? FROM\s+(\w+) - Words that follow the 'FROM' keyword, tbl_\w+ - Words that start with 'tbl_' prefix
        if (tableMatches) {
          tableMatches.forEach((match) => {
            const tableName = match.replace(/FROM\s+/i, "").trim();
            if (!tableName.startsWith("wfs")) {
              datasourcesSet.add(tableName);
            }
          });
        }
      }
    });

    // Find the actual dataset objects from mDatasetList
    const datasources = Array.from(datasourcesSet)
      .map((tableName) => {
        const dataset = mDatasetList.find(
          (d) => d.TableName === tableName || d.Name === tableName
        );
        if (dataset && !dataset.Name.startsWith("wfs")) {
          return {
            ID: dataset.ID,
            Name: dataset.Name,
            DatasetType: dataset.DatasetType,
            TableName: dataset.TableName,
            Description: dataset.Description || "",
            Origin: dataset.Origin || "",
            CRS: dataset.CRS || "",
            HasGeometry: dataset.HasGeometry || false,
            ShowPointIcon: dataset.ShowPointIcon || false,
            ShowPolygonIcon: dataset.ShowPolygonIcon || false,
            ShowLineIcon: dataset.ShowLineIcon || false,
            ShowJSONIcon: dataset.ShowJSONIcon || false,
            ShowCSVIcon: dataset.ShowCSVIcon || false,
            ShowTableIcon: !dataset.HasGeometry ? dataset.ShowTableIcon : false,
            ShowParquetIcon: dataset.ShowParquetIcon || false,
            RecordCount: dataset.RecordCount || null,
            GeometryType: dataset.GeometryType || null,
            GeomColName: dataset.GeomColName || null,
            ColumnsList: dataset.ColumnsList || [],
            SelColumnsList: dataset.SelColumnsList || [],
            Url: dataset.Url || null,
            UrlType: dataset.UrlType || null,
          };
        }
        return null;
      })
      .filter((dataset) => dataset !== null);

    workflowConfig = {
      ID: workflow.ID,
      Name: workflow.Name,
      Description: workflow.Description,
      Steps: workflowSteps,
      Datasources: datasources,
    };

    return workflowConfig;
  }

  // 20May2024
  function handleSaveWorkflowClickEvent() {
    // 17Jul2024
    const workflowName = $("#workFlowName").val();
    const workflowDescription = $("#workFlowDescription").val();
    // 16Jul2024
    const workflow = {
      ID: mHelperUtil.generateGUID(),
      Name: workflowName,
      Description: workflowDescription || "N/A",
      Steps: [],
      Configuration: {}, // Add a new object to store config information
      IsConfigured: false, // flag to indicate if the workflow was configured or not
    };

    mWorkflowsList.push(workflow);

    // ? clear the input fields
    $("#workFlowName").val("");
    $("#workFlowDescription").val("");

    const myModalEl = document.getElementById("divWorkflowPanel");
    const modal = bootstrap.Modal.getInstance(myModalEl); //
    modal.hide();

    addWorkflowToPanel(workflow); // 17Jul2024
  }

  // 20Aug2024
  function activateResultsMapView() {
    mResultsVizView = "Map";
    $("#results_map").removeClass("d-none");
    $("#radBtnResultsMap").prop("disabled", false); // 20Feb2025
    $("#radBtnResultsMap").prop("checked", true);
    $("#layer-control").removeClass("d-none"); // 25Jan2025
    deactivateResultsDataTableView(); // 20Aug2024
  }

  // 20Aug2024
  function activateResultsDataTableView() {
    mResultsVizView = "Table";
    $("#results_table").removeClass("d-none");
    $("#radBtnResultsDataTable").prop("checked", true);
    // 20Feb2025 deactivateResultsMapView();
  }

  // 20Aug2024
  function deactivateResultsDataTableView() {
    $("#results_table").addClass("d-none");
  }

  // 20Aug2024
  function deactivateResultsMapView() {
    $("#results_map").addClass("d-none");
    $("#layer-control").addClass("d-none"); // 25Jan2025
  }

  // 16Aug2024
  function handleResultsMapRadioButtonClickEvent(evt) {
    if (mResultsVizView === "Map") {
      return;
    }
    mResultsVizView = "Map";
    activateResultsMapView();

    // ? search for the dataset for the active map layer
    const activeMapLayerDataset = mDatasetList.find(function (d) {
      return d.Name === mResultsMap.getActiveMapLayerName();
    });

    // ? check if a block exists in the workspace
    const headBlock = getHeadBlock();

    // 28Jan2025
    // ? if the dataset is found, load the data into the map
    if (activeMapLayerDataset) {
      addDatasetToResultsView(activeMapLayerDataset);
    } else if (headBlock) {
      const headBlockTblName = "tblHeadBlock_" + headBlock.data.CustomID;
      if (mResultsMap.getActiveMapLayerName === headBlockTblName) {
        addWorkspaceBlockSQLQueryDataToResultsView(); // 19Aug2024
      }
      // 27Jan2025 activateResultsMapView(); // 20Aug2024
    }
  }

  function handleClearResutlsTableButtonClickEvent() {
    if (mResultsTable) {
      mResultsTable.clearTable();
    }

    clearDisplayQueryCode(); // 06Oct2024
  }

  // 16Aug2024
  function handleResultsTableRadioButtonClickEvent(evt) {
    if (mResultsVizView === "Table") {
      return;
    }

    if (!mResultsMap.getActiveMapLayerName()) {
      mResultsTable.clearTable();
      activateResultsDataTableView();
      return;
    }
    activateResultsDataTableView(); // 20Aug2024

    // ? search for the dataset for the active map layer
    const activeMapLayerDataset = mDatasetList.find(function (d) {
      return d.Name === mResultsMap.getActiveMapLayerName();
    });

    // 28Jan2025
    // ? if the dataset is found, load the data into the map
    if (activeMapLayerDataset) {
      addDatasetToResultsView(activeMapLayerDataset);
    } else {
      addWorkspaceBlockSQLQueryDataToResultsView(); // 19Aug2024
      // 27Jan2025 activateResultsMapView(); // 20Aug2024
    }
  }

  // 24Feb2025
  function handleResultsTableRadioButtonClickEventNew() {
    if (mResultsVizView === "Table") {
      return;
    }
    mResultsVizView = "Table";
    addDataToResultsViewNew2(mCurrentViewData.DataInfo); // 24Feb2025
  }

  // 31Aug2024
  function deactivatePreviewDataTableView() {
    $("#preview_table").addClass("d-none");
  }

  // 31Aug2024
  function deactivatePreviewMapView() {
    $("#preview_map").addClass("d-none");
  }

  // 31Aug2024
  function handlePreviewMapRadioButtonClickEvent() {
    if (mPreviewVizView === "Map") {
      return;
    }
    mPreviewVizView = "Map";
    displayDatasetPreviewViz();
  }

  // 31Aug2024
  function handlePreviewTableRadioButtonClickEvent() {
    if (mPreviewVizView === "DataTable") {
      return;
    }
    mPreviewVizView = "DataTable";
    displayDatasetPreviewViz();
  }

  // 22Sep2024
  function highlightWorkflowStep(workflowStepID) {
    $("#divWorkflowStep_" + workflowStepID).addClass("bg-warning");
    $("#divWorkflowStep_" + workflowStepID).addClass("bg-opacity-50");
  }

  // 22Sep2024
  function unhighlightWorkflowStep(workflowStepID) {
    $("#divWorkflowStep_" + workflowStepID).removeClass("bg-warning");
    $("#divWorkflowStep_" + workflowStepID).removeClass("bg-opacity-50");
  }

  // 22Sep2024
  async function handleSaveWorkflowStepEditsClickEvent() {
    const workflow = mWorkflowsList.find(function (wf) {
      return wf.ID === mEditWorkflowID;
    });

    const workflowStep = workflow.Steps.find(function (d) {
      return d.ID === mEditWorkflowStepID;
    });

    const blockConfig = {
      Name: workflowStep.Name,
      TableName: workflowStep.BlockDataset.TableName, // 08Feb2025
      Description: workflowStep.Description,
      CRS: workflowStep.BlockDataset.CRS,
    };

    const blockDataset = await createBlockDataset(blockConfig);
    workflowStep.BlockDataset = blockDataset;

    $("#btnSaveEditWorkflowStep_" + mEditWorkflowStepID).addClass("d-none"); // 04Oct2024
    $("#btnEditWorkflowStep_" + mEditWorkflowStepID).removeClass("d-none"); // 04Oct2024
    $("#btnSaveBlockWorkflowStep").removeClass("d-none"); // 06Oct2024

    unhighlightWorkflowStep(mEditWorkflowStepID);
  }

  // 22Sep2024
  async function handleStartWorkflowStepEditClickEvent(evt) {
    const elemID = $(evt.currentTarget).attr("id");
    const workflowStepID = elemID.split("_")[1];

    mEditWorkflowStepID = workflowStepID; // 22Sep2024
    highlightWorkflowStep(workflowStepID); // 22Sep2024
    $("#btnSaveBlockWorkflowStep").addClass("d-none");
    // 06Oct2024 $("#btnSaveWorkflowStepEdits").removeClass("d-none");
    $("#btnSaveEditWorkflowStep_" + workflowStepID).removeClass("d-none"); // 04Oct2024
    $("#btnEditWorkflowStep_" + workflowStepID).addClass("d-none"); // 04Oct2024

    const workflow = mWorkflowsList.find(function (wf) {
      return wf.ID === mEditWorkflowID;
    });

    const workflowStep = workflow.Steps.find(function (d) {
      return d.ID === workflowStepID;
    });

    if (!workflowStep) {
      displayAlert(`Error: Could not find this workflow step object!`);
      throw new Error(`Error: Could not find this workflow step object!`);
    }

    const serializedJson = JSON.parse(
      workflowStep.BlockDataset.SerializedWorkspaceJSON
    );
    Blockly.serialization.workspaces.load(serializedJson, mBlocklyWorkspace);
  }

  /*   // 22Jul2024
  async function handleSaveWorkflowStepClickEvent(evt) {
    let stepNumber;
    let workflowStepName = $("#workflowStepName").val();
    const workflowStepDescription = $("#workflowStepDescription").val();
    const workflow = mWorkflowsList.find(function (wf) {
      return wf.ID === mEditWorkflowID;
    });

    let blocks = mBlocklyWorkspace.getTopBlocks(false);
    if (blocks.length === 0) {
      displayAlert("Error: Could not find blocks in the workspace!");
      return;
    }

    if (!workflow) {
      displayAlert("Error: Could not find the workflow!");
      return;
    }

    if (workflow.Steps.length === 0) {
      stepNumber = 1;
    } else {
      const lastStep = workflow.Steps[workflow.Steps.length - 1];
      stepNumber = lastStep.Number + 1;
    }

    // 14Sep2024
    const datasetCRS = getGeomCRS(); // 14Sep2024

    // 30Jul2024
    const datasetConfig = {
      Name: workflowStepName,
      TableName: workflowStepName.replace(/ /g, "_"), // ? replace space with underscore, 27Jan2025
      Description: workflowStepDescription || "N/A",
      CRS: datasetCRS // 14Sep2024
    };

    // 30Jul2024
    const blockDataset = await createBlockDataset(datasetConfig);

    const workflowStep = {
      // 10Feb2025 ID: mHelperUtil.generateGUID(),
      ID: blockDataset.ID, // ? same as Block dataset, 10Feb2025
      Number: stepNumber,
      Name: workflowStepName,
      Description: workflowStepDescription || "N/A",
      BlockDataset: blockDataset
    };

    // ? add the step to workflow
    workflow.Steps.push(workflowStep);

    // ? add the step to workflow panel
    addWorkflowStepToWorkflowPanel(workflowStep);
    setEditWorkflowStepIconStatus(); // 20Sep2024

    mDatasetList.push(blockDataset);
    // ? Re-create spatial logic blocks to add this dataset

    updateBlocks(); // 14Sep2024

    // ? clear the input fields,  // 21Jun2024
    $("#workflowStepName").val("");
    $("#workflowStepDescription").val("");

    const modalEl = document.getElementById("divWorkflowStepPanel");
    const modal = bootstrap.Modal.getInstance(modalEl); //
    modal.hide();
  } */

  // 21Feb2025
  async function handleSaveWorkflowStepClickEventNew1() {
    let stepNumber;
    let workflowStepName = $("#workflowStepName").val();
    const workflowStepDescription = $("#workflowStepDescription").val();
    const workflow = mWorkflowsList.find(function (wf) {
      return wf.ID === mEditWorkflowID;
    });

    displayLoadingIcon("divSaveWorkflowStepLoadingIcon"); // 12Feb2025

    if (workflow.Steps.length === 0) {
      stepNumber = 1;
    } else {
      const lastStep = workflow.Steps[workflow.Steps.length - 1];
      stepNumber = lastStep.Number + 1;
    }

    // ? add prefix 24Feb2025
    workflowStepName = `wfs_${workflowStepName}`;
    // ? create a new Block dataset
    const uniqueID = mHelperUtil.generateShortGUID();
    const datasetConfig = {
      ID: uniqueID,
      TableName: `tbl_${uniqueID}`,
      Name: workflowStepName,
      Description: workflowStepDescription || "N/A", // 11Apr2025
    };

    // ? Check if the current block(s) code was executed. The way to know if it was executed
    // ? is by checking if a table exists in DuckDB with the name with 'tblHeadBlock_{mBlockID}' of the
    // ? Head block (first block of the workspace)
    const headBlock = getHeadBlock();
    let headBlockTblName = "tblHeadBlock_" + headBlock.data.CustomID;
    const tblExists = await tableExists(headBlockTblName);
    let blockDataset;
    let dataInfo = null;
    try {
      if (tblExists) {
        // ? if the table exists, then rename the table to a new Block dataset ID
        // ? to differentiate between BlockCode tables and BlockDataset tables
        // ? executed block code table names start with "tblHeadBlock_"
        // ? saved Dataset table names start with "tbl_"
        await renameTable(headBlockTblName, datasetConfig.TableName);
        dataInfo = await getExecutedBlockDataInfo();
      } else {
        dataInfo = await getExecutedBlockDataInfo();
        headBlockTblName = dataInfo.TableName;
        await renameTable(headBlockTblName, datasetConfig.TableName);
      }
      blockDataset = await createBlockDatasetNew(datasetConfig);
      // Preserve categoryColors and categoryColumn if they exist in dataInfo
      if (dataInfo && dataInfo.CategoryColors) {
        blockDataset.CategoryColors = dataInfo.CategoryColors;
      }

      if (dataInfo && dataInfo.CategoryColumn) {
        blockDataset.CategoryColumn = dataInfo.CategoryColumn;
      }
    } catch (error) {
      console.log(error);
      closeBlockDatasetModalWindow();
      displayAlert(
        "There was an error while creating this dataset. \n Please check the parameters."
      );
      return;
    }

    const workflowStep = {
      // 10Feb2025 ID: mHelperUtil.generateGUID(),
      ID: blockDataset.ID, // ? same as Block dataset, 10Feb2025
      Number: stepNumber,
      Name: workflowStepName,
      Description: workflowStepDescription || "N/A",
      BlockDataset: blockDataset,
    };

    // ? add the step to workflow
    workflow.Steps.push(workflowStep);

    // ? add the step to workflow panel
    // 10Mar2025 addWorkflowStepToWorkflowPanel(workflowStep);
    addWorkflowStepToWorkflowPanel(workflowStep, workflow.ID); // 10Mar2025
    setEditWorkflowStepIconStatus(); // 20Sep2024

    mDatasetList.push(blockDataset);
    // ? Re-create spatial logic blocks to add this dataset
    // 14Sep2024 createSpatialFindBlock(); // 11Jun2024
    // 14Sep2024 createSpatialWhereBlock(); // 11Jun2024
    updateBlocks(); // 14Sep2024

    // ? clear the input fields,  // 21Jun2024
    $("#workflowStepName").val("");
    $("#workflowStepDescription").val("");

    const modalEl = document.getElementById("divWorkflowStepPanel");
    const modal = bootstrap.Modal.getInstance(modalEl); //
    hideLoadingIcon("divSaveWorkflowStepLoadingIcon"); // 12Feb2025
    modal.hide();
  }

  // 20Sep2024
  function setEditWorkflowStepIconStatus() {
    if (mEditWorkflowFlag) {
      $("[rel=js-edit-workflow-step]").removeClass("d-none");
    } else {
      $("[rel=js-edit-workflow-step]").addClass("d-none");
    }
  }

  // 19Jul2024
  function handleStartEditWorkflowClickEvent(evt) {
    const elemID = $(evt.target).attr("id");
    const workflowID = elemID.split("_")[1]; // 20Jun2024

    mEditWorkflowID = workflowID;
    mEditWorkflowFlag = true; // 19Sep2024
    $(this).addClass("d-none");
    $("#btnSaveBlockAsDataset").addClass("d-none"); // 23Jul2024
    $("#btnStopEditWorkflow_" + workflowID).removeClass("d-none");
    $("#btnSaveBlockWorkflowStep").removeClass("d-none");
    $("button[rel='js-preview-workflow-step']").removeClass("d-none"); // 06Oct2024
    $("#btnGenerateWorkflowConfig_" + workflowID).removeClass("d-none"); // 11Mar2025
    $("#btnDeleteWorkflow_" + workflowID).removeClass("d-none"); // 11Mar2025
    addWorkflowStepsDatasets(workflowID); // 21Sep2024
    setEditWorkflowStepIconStatus(); // 20Sep2024
  }

  // 19Sep2024
  function removeWorkflowStepsDatasets(workflowID) {
    const workflow = mWorkflowsList.find(function (wf) {
      return wf.ID === workflowID;
    });

    const workflowSteps = workflow.Steps.map(function (step) {
      return step;
    });

    const datasetIDListToRemove = workflowSteps.map(function (step) {
      return step.BlockDataset.ID;
    });

    const updatedDatasetList = mDatasetList.filter(function (ds) {
      return !datasetIDListToRemove.includes(ds.ID);
    });
    mDatasetList = updatedDatasetList;
  }

  // 21Sep2024
  function addWorkflowStepsDatasets(workflowID) {
    const workflow = mWorkflowsList.find(function (wf) {
      return wf.ID === workflowID;
    });

    const workflowSteps = workflow.Steps.map(function (step) {
      return step;
    });

    if (workflowSteps && workflowSteps.length > 0) {
      workflowSteps.forEach(function (step) {
        mDatasetList.push(step.BlockDataset);
      });

      updateBlocks();
    }
  }

  // 22Jul2024
  function handleStopEditWorkflowClickEvent(evt) {
    const elemID = $(evt.target).attr("id");
    const workflowID = elemID.split("_")[1]; // 20Jun2024

    // 11Mar2025 removeWorkflowStepsDatasets(workflowID); // 19Sep2024
    unhighlightWorkflowStep(mEditWorkflowID); // 20Sep2024
    mEditWorkflowFlag = false; // 19Sep2024
    mEditWorkflowStepID = null;

    // 14Sep2024
    updateBlocks(); // 14Sep2024

    $(this).addClass("d-none");
    $("#btnSaveBlockAsDataset").removeClass("d-none"); // 23Jul2024
    $("#btnEditWorkflow_" + workflowID).removeClass("d-none");
    $("#btnSaveBlockWorkflowStep").addClass("d-none");
    $("#btnGenerateWorkflowConfig_" + workflowID).addClass("d-none"); // 11Mar2025
    $("#btnDeleteWorkflow_" + workflowID).addClass("d-none"); // 11Mar2025

    setEditWorkflowStepIconStatus(); // 20Sep2024
  }

  // 19May2024
  function countNumOfDisconnectedBlocksInWorkspace(workspace) {
    let disconnectedCount = 0;
    let blocks = workspace.getTopBlocks(false);
    let block;
    for (let i = 0; i < blocks.length; i += 1) {
      block = blocks[i];
      if (!block.getParent() && block.isDeletable()) {
        disconnectedCount++;
      }
    }
    return disconnectedCount;
  }

  // 21May2024
  function displayAlert(message) {
    const modalEl = document.getElementById("divGenericaModal");
    $("#pAlertText").html(message);
    const modal = new bootstrap.Modal(modalEl);
    modal.show(); // Shows the modal
  }

  // 14Aug2024
  function getHeadBlock() {
    // 18Feb2025
    let workspaceBlocks = mBlocklyWorkspace.topBlocks; // 19May2024
    // ? There can be only one Head block at a time in the workspace
    const block = workspaceBlocks.find(function (block) {
      return block.data.IsHeadBlock === true;
    });
    if (block) {
      return block;
    }

    return null;
  }

  // 26Aug2024
  function getHeadBlockDatasetName() {
    let datasetName;
    const headBlock = getHeadBlock();

    // 12Feb2025
    if (
      headBlock.type === "spatial_find_join_block" ||
      headBlock.type === "aggregation_find_groupby_block" ||
      headBlock.type === "aggregation_data_combine_block"
    ) {
      datasetName = headBlock.getFieldValue("DATASET1");
    } else {
      datasetName = headBlock.getFieldValue("DATASET");
    }

    return datasetName;
  }

  // 14Aug2024
  function getGeomCRS() {
    const datasetName = getHeadBlockDatasetName(); // 26Aug2024
    /*  // 12Feb2025
    if (datasetName === "buffer_geometry") {
      return "EPSG:3857"; // ? buffer_geometry is always created in EPSG:3857
    } */

    const dataset = mDatasetList.find(function (ds) {
      return ds.Name === datasetName;
    });

    // 09Feb2025
    let geomCRS;
    if (dataset.HasGeometry) {
      geomCRS = dataset.CRS; // 14Aug2024
    } else {
      geomCRS = "N/A";
    }

    return geomCRS;
  }

  // 24Jul2024
  async function executeWorkspaceBlockSQLQuery(tblName) {
    let message;

    // ? check for disconnected blocks
    const numOfDisconnectedBlocks =
      countNumOfDisconnectedBlocksInWorkspace(mBlocklyWorkspace);
    if (numOfDisconnectedBlocks > 1) {
      const message =
        "<strong></strong>Unable to save!</strong> </br> There are " +
        numOfDisconnectedBlocks +
        " disconnected blocks. </br> There can be only one block or one connected sequence of blocks.";
      displayAlert(message);
      return;
    }

    // ? Get Block query code
    let queryCode = javascriptGenerator.workspaceToCode(
      Blockly.getMainWorkspace()
    );
    // ? Check for query code
    if (!queryCode || queryCode.length === 0) {
      message =
        "There is no code associated with this block</br> the dataset cannot be generated and saved.";
      displayAlert(message);
      return;
    }

    // ? Reason to replace table name in the query code:  // 29Sep2024
    // ? Whenever a new dataset is added or removed, all the blocks (in tools and workspace)
    // ? need to be updated with updateBlocks(). This function creates a new instance of the block, so the
    // ? BlockID is re-generated and will be different than the original one. The reason we cannot keep the
    // ? original BlockID of each block during first creation, is that we need the BlockID to be different
    // ? for each new instance of the same block type in the main workspace. This BlockID is used as the unique
    // ? tableName to store the data when the block code of that block instance is executed.

    // 06Oct2024
    // ? Delete pre-existing tables
    await mDBConn.query(`DROP TABLE IF EXISTS ${tblName}`);
    queryCode = queryCode.replace(/tblHeadBlock_\w+/, tblName); // ? Replace the table name that starts with 'tblHeadBlock_' (created in the Block definition)

    displayQueryCode(queryCode); // 29Sep2024

    // ? Run Block query Code
    await mDBConn.query(queryCode);

    /* // ? TEST, Check if DuckDB is using the RTREE index for spatial queries,  // 13Feb2025
    // Get the EXPLAIN output
    const explainQuery = `EXPLAIN ${queryCode}`;
    const explainResult = await mDBConn.query(explainQuery);
    const explainOutput = explainResult.toArray().map(Object.fromEntries);
    console.log("EXPLAIN output:", explainOutput); */
  }

  // 29Aug2024
  async function getGeomTypeFromTable(tableName, geomColumnName) {
    // ? get geometry type

    // 11Feb2025
    const geomTypeQuery = `SELECT DISTINCT ST_GeometryType(${geomColumnName}) As geom_type FROM ${tableName}`;
    const geomTypeResult = await mDBConn.query(geomTypeQuery);
    const geomTypeDataArr = geomTypeResult.toArray().map(Object.fromEntries);
    const geomType = geomTypeDataArr[0].geom_type;

    return geomType;
  }

  // 24Jul2024
  async function createBlockDataset(config) {
    let blockDataset;
    // ? Serialize workspace to re-create blocks
    const serializedWorkspace =
      Blockly.serialization.workspaces.save(mBlocklyWorkspace);
    const serializedWorkspaceJSONString = JSON.stringify(serializedWorkspace);

    // ? create dataset
    try {
      await executeWorkspaceBlockSQLQuery(config.TableName); // ? // ? Execute Block Code,  // 29Sep2024
    } catch (error) {
      await mDBConn.query(`DROP TABLE IF EXISTS ${config.TableName}`); // ? clean up
      throw new Error(`Error: ${error}`);
    }

    const columnsList = await getColumnsListFromTable(config.TableName);
    const recordCount = await getRecordCountFromTable(config.TableName);

    // ? Get Block query code
    let queryCode = javascriptGenerator.workspaceToCode(
      Blockly.getMainWorkspace()
    );

    blockDataset = {
      // 11Feb2025 ID: mHelperUtil.generateGUID(),
      ID: config.ID,
      Name: config.Name,
      Origin: mDatasetOriginTypes.Block,
      CRS: config.CRS, // 26Jul2024
      Description: config.Description || "N/A", // 11Jun2024
      TableName: config.TableName,
      SerializedWorkspaceJSON: serializedWorkspaceJSONString,
      SQLCode: queryCode, // 14Jan2025
      DatasetType: "Block",
      ColumnsList: columnsList,
      SelColumnsList: columnsList, // 11Mar2025
      RecordCount: recordCount, // 19Aug2024
      SelColumnsList: columnsList,
      ShowPointIcon: false,
      ShowPolygonIcon: false,
      ShowLineIcon: false,
      ShowBlockIcon: false, // 08Feb2025
      ShowTableIcon: false, // 08Feb2025
      HasGeometry: false,
      GeometryType: "N/A",
    };

    let geomType;
    let geomColumnName;
    const hasGeometry = hasGeometryColumn(columnsList);
    const hasBufferGeometry = hasBufferGeometryColumn(columnsList);

    if (hasGeometry || hasBufferGeometry) {
      blockDataset.HasGeometry = true;
      geomColumnName = getGeomColName(columnsList); // 10Jan2025
      blockDataset.GeomColName = geomColumnName; // 05Feb2025
      geomType = await getGeomTypeFromTable(config.TableName, geomColumnName);

      blockDataset.GeometryType = geomType; // 08Jun2024

      if (
        geomType === mGeometryTypes.Point ||
        geomType === mGeometryTypes.MultiPoint
      ) {
        blockDataset.ShowPointIcon = true;
      }

      if (
        geomType === mGeometryTypes.Polygon ||
        geomType === mGeometryTypes.Multipolygon
      ) {
        blockDataset.ShowPolygonIcon = true;
      }

      if (
        geomType === mGeometryTypes.Line ||
        geomType === mGeometryTypes.MultiLine
      ) {
        blockDataset.ShowLineIcon = true;
      }

      blockDataset.GeometryType = geomType;
    } else {
      blockDataset.ShowTableIcon = true; // 08Feb2025
    }

    setDataTypeIcon(blockDataset, mDatasetOriginTypes.Block); // 08Feb2025

    return blockDataset;
  }

  // 21Sep2024
  function closeBlockDatasetModalWindow() {
    // ? clear the input fields,  // 21Jun2024
    $("#blockDatasetName").val("");
    $("#blockDatasetCRS").val(""); // 26Jul2024
    $("#blockDatasetDescription").val("");

    const modalEl = document.getElementById("divBlockDatasetPanel");
    const modal = bootstrap.Modal.getInstance(modalEl); //
    modal.hide();
  }

  /*   // 19May2024
  async function handleSaveBlockAsDatasetClickEvent() {
    const blocks = mBlocklyWorkspace.getTopBlocks(false);
    if (blocks.length === 0) {
      displayAlert("There are no blocks in the workspace!");
      return;
    }
    let datasetName = $("#blockDatasetName").val();

    const datasetCRS = getGeomCRS(); // 07Sep2024
    const datasetDescription = $("#blockDatasetDescription").val(); // 11Jun2024

    const datasetConfig = {
      ID: mHelperUtil.generateShortGUID(),
      Name: datasetName,
      Description: datasetDescription || "N/A",
      CRS: datasetCRS
    };
    datasetConfig.TableName = `tbl_${datasetConfig.ID}`; // 11Feb2025

    let blockDataset;
    try {
      blockDataset = await createBlockDataset(datasetConfig); // 24Jul2024
    } catch (error) {
      closeBlockDatasetModalWindow();
      displayAlert(
        "There was an error while creating this dataset. \n Please check the parameters."
      );
      return;
    }
    mDatasetList.push(blockDataset); // 08Jun2024
    addBlockDatasetToPanel(blockDataset); // 21Jun2024
    updateBlocks(); // 30Aug2024
    closeBlockDatasetModalWindow(); // 21Sep2024
  } */

  // 11Feb2025
  async function tableExists(tableName) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        WHERE table_name = '${tableName}'
      `;
      const result = await mDBConn.query(query);
      const count = result.toArray()[0].count;
      return count > 0;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  // 11Feb2025
  async function renameTable(oldTableName, newTableName) {
    try {
      const query = `ALTER TABLE ${oldTableName} RENAME TO ${newTableName}`;
      await mDBConn.query(query);
      return true;
    } catch (error) {
      console.error(`Error renaming table ${oldTableName}:`, error);
      return false;
    }
  }

  // 11Feb2025
  async function createBlockDatasetNew(config) {
    const columnsList = await getColumnsListFromTable(config.TableName);
    const recordCount = await getRecordCountFromTable(config.TableName);

    const serializedWorkspace =
      Blockly.serialization.workspaces.save(mBlocklyWorkspace);
    const serializedWorkspaceJSONString = JSON.stringify(serializedWorkspace);
    let queryCode = javascriptGenerator.workspaceToCode(
      Blockly.getMainWorkspace()
    );
    // ? rename the table to a new Block dataset ID
    // ? to differentiate between BlockCode tables and BlockDataset tables
    // ? executed block code table names start with "tblHeadBlock_"
    // ? saved Dataset table names start with "tbl_"
    // 11Mar2025 queryCode = queryCode.replace(/tblHeadBlock_\w+/, config.TableName); // ? Replace the table name that starts with 'tblHeadBlock_' (created in the Block definition)
    queryCode = queryCode.replace(/tblHeadBlock_\w+/g, config.TableName); //? 11Mar2025 ? Replace all table names that start with 'tblHeadBlock_' (created in the Block definition)

    // ? Add properties from config to blockDataset using spread operator
    const blockDataset = {
      ...config,
      Origin: mDatasetOriginTypes.Block,
      DatasetType: "Block",
      ColumnsList: columnsList,
      SelColumnsList: columnsList,
      RecordCount: recordCount,
      SerializedWorkspaceJSON: serializedWorkspaceJSONString,
      SQLCode: queryCode,
      ShowPointIcon: false,
      ShowPolygonIcon: false,
      ShowLineIcon: false,
      ShowBlockIcon: false,
      ShowTableIcon: false,
      HasGeometry: false,
      GeometryType: "N/A",
    };

    const hasGeometry = hasGeometryColumn(columnsList);
    if (hasGeometry) {
      const geomColName = getGeomColName(columnsList);

      const geomType = await getGeomTypeFromTable(
        config.TableName,
        geomColName
      );

      const datasetCRS = getGeomCRS();
      blockDataset.CRS = datasetCRS;
      blockDataset.HasGeometry = true;
      blockDataset.GeomColName = geomColName;
      blockDataset.GeometryType = geomType;

      if (
        geomType === mGeometryTypes.Point ||
        geomType === mGeometryTypes.MultiPoint
      ) {
        blockDataset.ShowPointIcon = true;
      }

      if (
        geomType === mGeometryTypes.Polygon ||
        geomType === mGeometryTypes.Multipolygon
      ) {
        blockDataset.ShowPolygonIcon = true;
      }

      if (
        geomType === mGeometryTypes.Line ||
        geomType === mGeometryTypes.MultiLine
      ) {
        blockDataset.ShowLineIcon = true;
      }
    } else {
      blockDataset.ShowTableIcon = true;
    }

    setDataTypeIcon(blockDataset, mDatasetOriginTypes.Block); // 08Feb2025
    return blockDataset;
  }

  // 23Feb2025
  async function handleSaveBlockAsDatasetClickEventNew1() {
    // ? check if blocks exist in workspace
    const blocks = mBlocklyWorkspace.getTopBlocks(false);
    if (blocks.length === 0) {
      displayAlert("There are no blocks in the workspace!");
      return;
    }

    // ? check for disconnected blocks
    const numOfDisconnectedBlocks =
      countNumOfDisconnectedBlocksInWorkspace(mBlocklyWorkspace);
    if (numOfDisconnectedBlocks > 1) {
      const message =
        "<strong></strong>Unable to save!</strong> </br> There are " +
        numOfDisconnectedBlocks +
        " disconnected blocks. </br> There can be only one block or one connected sequence of blocks.";
      displayAlert(message);
      return;
    }

    displayLoadingIcon("divSaveBlockDatasetLoadingIcon"); // 12Feb2025

    const datasetName = $("#blockDatasetName").val();
    const datasetDescription = $("#blockDatasetDescription").val();

    // ? create a new Block dataset
    const uniqueID = mHelperUtil.generateShortGUID();
    const datasetConfig = {
      ID: uniqueID,
      Name: datasetName,
      TableName: `tbl_${uniqueID}`,
      Description: datasetDescription || "N/A",
    };

    // ? Check if the current block(s) code was executed. The way to know if it was executed
    // ? is by checking if a table exists in DuckDB with the name with 'tblHeadBlock_{mBlockID}' of the
    // ? Head block (first block of the workspace)
    const headBlock = getHeadBlock();
    let headBlockTblName = "tblHeadBlock_" + headBlock.data.CustomID;
    const tblExists = await tableExists(headBlockTblName);
    let blockDataset;
    let dataInfo = null;
    try {
      if (tblExists) {
        // ? if the table exists, then rename the table to a new Block dataset ID
        // ? to differentiate between BlockCode tables and BlockDataset tables
        // ? executed block code table names start with "tblHeadBlock_"
        // ? saved Dataset table names start with "tbl_"
        await renameTable(headBlockTblName, datasetConfig.TableName);
        // Get the executed block data info to preserve categoryColors and categoryColumn
        dataInfo = await getExecutedBlockDataInfo();
      } else {
        dataInfo = await getExecutedBlockDataInfo();
        headBlockTblName = dataInfo.TableName;
        await renameTable(headBlockTblName, datasetConfig.TableName);
      }
      blockDataset = await createBlockDatasetNew(datasetConfig);
      //? Preserve categoryColors and categoryColumn if they exist in dataInfo
      if (dataInfo && dataInfo.CategoryColors) {
        blockDataset.CategoryColors = dataInfo.CategoryColors;
      }

      if (dataInfo && dataInfo.CategoryColumn) {
        blockDataset.CategoryColumn = dataInfo.CategoryColumn;
      }
    } catch (error) {
      console.log(error);
      closeBlockDatasetModalWindow();
      displayAlert(
        "There was an error while creating this dataset. \n Please check the parameters."
      );
      return;
    }

    mDatasetList.push(blockDataset); // 08Jun2024
    addBlockDatasetToPanel(blockDataset); // 21Jun2024
    updateBlocks(); // 30Aug2024
    hideLoadingIcon("divSaveBlockDatasetLoadingIcon"); // 12Feb2025
    closeBlockDatasetModalWindow(); // 21Sep2024
  }

  // 18Aug2024
  function displayQueryCode(queryCode) {
    $("#divQueryInfo").empty(); // 17May2024
    $("#divQueryInfo").append(queryCode); // 17May2024
  }

  // 06Oct2024
  function clearDisplayQueryCode() {
    $("#divQueryInfo").empty();
  }

  // 19Aug2024
  async function addWorkspaceBlockSQLQueryDataToResultsView() {
    const headBlock = getHeadBlock();
    const headBlockTblName = "tblHeadBlock_" + headBlock.data.CustomID; // 13Aug2024
    const columnsList = await getColumnsListFromTable(headBlockTblName); // 05Feb2025
    // ? Check if data is spatial,  // 11Feb2025
    const isSpatialData = hasGeometryColumn(columnsList); // 12Feb2025

    // 05Feb2025
    let q;
    let geomColName;
    if (isSpatialData) {
      geomColName = getGeomColName(columnsList); // 05Feb2025
      q = `SELECT * EXCLUDE(${geomColName}) FROM  ${headBlockTblName}`;
    } else {
      q = `SELECT * FROM  ${headBlockTblName}`;
    }

    const result = await mDBConn.query(q);
    const dataArr = result.toArray().map(Object.fromEntries);

    if (!dataArr || dataArr.length === 0) {
      $("#results_map").empty();
      $("results_table").empty();
      displayAlert("No records that matched this criteria were found!");
      return;
    }

    // ? remove 'geometry' column from columnsList
    const noGeometryColumnsList = getNoGeometryColumnsList(columnsList); // 31Aug2024

    // ? MAP

    // 12Feb2025
    if (!isSpatialData) {
      $("#radBtnPreviewMap").prop("disabled", true);
    } else {
      $("#radBtnPreviewMap").prop("disabled", false);
    }

    if (isSpatialData && mResultsVizView === "Map") {
      let querySQL;

      // 12Feb2025
      const geomColNameArr = getAllGeomColNames(columnsList); // ? some datasets might contain multiple geometry columns when it is created by combining two spatial datasets
      // ? create a comma separated list of geometry column names
      const geomColNamesStr = geomColNameArr.join(", ");
      const geomCRS = getGeomCRS(); // 14Aug2024;
      const geomType = await getGeomTypeFromTable(
        headBlockTblName,
        geomColName
      ); // 13Feb2025

      // ? Exclude original geometry column so that it does not gets displayed in results table and map tooltip  // 12Feb2025
      querySQL = `SELECT * EXCLUDE(${geomColNamesStr}), ST_AsWKB(ST_Transform(${geomColName},'${geomCRS}','EPSG:3857')) As wkb FROM ${headBlockTblName}`; // ? Binary format,  // 12Feb2025

      // 15Aug2024
      const result = await mDBConn.query(querySQL);
      const mapFeaturesArr = result.toArray().map(Object.fromEntries);

      activateResultsMapView();

      // 20Jan2025
      const layerConfig = {
        LayerName: headBlockTblName,
        MapFeatures: mapFeaturesArr, // 05Feb2025
        GeometryType: geomType, // 13Feb2025
      };
      mResultsMap.addMapLayer(layerConfig);
    } else {
      activateResultsDataTableView();
      deactivateResultsMapView();
      if (!isSpatialData) {
        $("#radBtnResultsMap").prop("disabled", true);
      }
      // ? DATA TABLE
      const tableConfig = {
        TableContainerID: "results_table",
        TableID: "tblQueryResults",
        ColumnsList: noGeometryColumnsList,
        TableData: dataArr,
      };
      createDataTable(tableConfig);
    }
  }

  // 20Feb2025
  function doDisconnectedBlocksExistInWorkspace() {
    const numOfDisconnectedBlocks =
      countNumOfDisconnectedBlocksInWorkspace(mBlocklyWorkspace);
    return numOfDisconnectedBlocks > 1;
  }

  // 24Feb2025
  function addDataToResultsViewNew2(dataInfo) {
    // ? Object destructuring
    const {
      HasGeometry,
      Name,
      TableName,
      GeometryType,
      CategoryColors,
      CategoryColumn,
      ColumnsList,
    } = dataInfo || {};
    const { MapRecords, TableRecords } = mCurrentViewData || {};

    if (HasGeometry) {
      $("#results_map").removeClass("d-none");
      $("#radBtnResultsMap").prop("disabled", false); // 20Feb2025
    } else {
      $("#results_map").removeClass("d-none");
      $("#radBtnResultsMap").prop("disabled", true); // 20Feb2025
      mResultsVizView = "Table";
    }

    if (mResultsVizView === "Map") {
      $("#radBtnResultsMap").prop("checked", true);
      // ? show map elements
      $("#results_map").removeClass("d-none");
      $("#layer-control").removeClass("d-none");

      // ? hide table element
      $("#results_table").addClass("d-none");

      const mapConfig = {
        LayerName: Name,
        MapFeatures: MapRecords,
        GeometryType,
      };

      if (CategoryColors) {
        mapConfig.CategoryColors = CategoryColors;
        mapConfig.CategoryColumn = CategoryColumn;
      }
      mResultsMap.addMapLayer(mapConfig);
    }

    if (mResultsVizView === "Table") {
      // ? hide map elements
      $("#results_map").addClass("d-none");
      $("#layer-control").addClass("d-none");

      // ? show table elements
      $("#results_table").removeClass("d-none");
      $("#radBtnResultsDataTable").prop("checked", true);
      const noGeometryColumnsList = ColumnsList.filter(function (column) {
        return column.ColumnType.toUpperCase() !== "GEOMETRY";
      });

      createDataTable({
        TableContainerID: "results_table",
        TableID: "tblQueryResults",
        ColumnsList: noGeometryColumnsList,
        TableData: TableRecords,
      });
    }
  }

  // 20Feb2025
  async function executeVizBlock(headBlock) {
    let blocksOutput = javascriptGenerator.workspaceToCode(mBlocklyWorkspace);
    let sqlCode = getSqlCode(blocksOutput);
    let jsonObjects = getJsonObjects(blocksOutput);

    // ? Check for query code
    if (!sqlCode || sqlCode.length === 0) {
      const message =
        "There is no code associated with this block</br> the dataset cannot be generated and saved.";
      displayAlert(message);
      return;
    }
    const headBlockTblName = "tblHeadBlock_" + headBlock.data.CustomID;
    await mDBConn.query(`DROP TABLE IF EXISTS ${headBlockTblName}`);

    displayQueryCode(sqlCode);

    // ? Run Block query Code
    await mDBConn.query(sqlCode);

    // ? get info from headBlockTblName
    const columnsList = await getColumnsListFromTable(headBlockTblName);
    const hasGeometry = hasGeometryColumn(columnsList);
    let geomColName;
    let geomCRS;
    let geomType;
    if (hasGeometry) {
      geomColName = getGeomColName(columnsList);
      geomCRS = getGeomCRS();
      geomType = await getGeomTypeFromTable(headBlockTblName, geomColName);
    }
    const results = {
      TableName: headBlockTblName,
      Name: headBlockTblName,
      ColumnsList: columnsList,
      SelColumnsList: columnsList, // 11Mar2025
      HasGeometry: hasGeometry,
      GeomColName: geomColName,
      GeometryType: geomType,
      CRS: geomCRS,
      CategoryColumn: jsonObjects.categoryColumn,
      CategoryColors: jsonObjects.categoryColors
        ? jsonObjects.categoryColors
        : null,
    };

    return results;
  }

  // 22Feb2025
  function getSqlCode(jsonString) {
    const jsonObjectStrings = jsonString.split(/;\s*\n/); // ? split at semicolon, followed by zero or more whitespaces characters, followed by newline character
    const jsonStrArr = jsonObjectStrings.filter(function (d) {
      return d !== "";
    });

    const code = jsonStrArr.reduce((accumulator, currentObject) => {
      const jsonObj = JSON.parse(currentObject);
      if (jsonObj.hasOwnProperty("sqlCode")) {
        return accumulator + jsonObj["sqlCode"];
      }
      return accumulator;
    }, "");
    return code;
  }

  // 23Feb2025
  function getJsonObjects(jsonString) {
    const jsonObjectStrings = jsonString.split(/;\s*\n/); // ? split at semicolon, followed by zero or more whitespaces characters, followed by newline character
    const jsonStrArr = jsonObjectStrings.filter(function (d) {
      return d !== "";
    });
    return JSON.parse(jsonStrArr);
  }

  // 20Feb2025
  async function executeQueryBlock(headBlock) {
    let blocksOutput = javascriptGenerator.workspaceToCode(mBlocklyWorkspace);
    let sqlCode = getSqlCode(blocksOutput);

    // ? Check for query code
    if (!sqlCode || sqlCode.length === 0) {
      const message =
        "There is no code associated with this block</br> the dataset cannot be generated and saved.";
      displayAlert(message);
      return;
    }

    // 06Oct2024
    const headBlockTblName = "tblHeadBlock_" + headBlock.data.CustomID;
    // ? Delete pre-existing tables
    await mDBConn.query(`DROP TABLE IF EXISTS ${headBlockTblName}`);
    // ? Fixed the bug that required this step, 23Feb2025  sqlCode = sqlCode.replace(/tblHeadBlock_\w+/, headBlockTblName); // TODO: Remove this line // ? Replace the table name that starts with 'tblHeadBlock_' (created in the Block definition)

    displayQueryCode(sqlCode);

    // ? Run Block query Code
    await mDBConn.query(sqlCode);

    // ? get info from headBlockTblName
    const columnsList = await getColumnsListFromTable(headBlockTblName);
    const hasGeometry = hasGeometryColumn(columnsList);
    let geomColName;
    let geomCRS;
    let geomType;
    if (hasGeometry) {
      geomColName = getGeomColName(columnsList);
      geomCRS = getGeomCRS();
      geomType = await getGeomTypeFromTable(headBlockTblName, geomColName);
    }
    const results = {
      TableName: headBlockTblName,
      Name: headBlockTblName,
      ColumnsList: columnsList,
      SelColumnsList: columnsList, // 11Mar2025
      HasGeometry: hasGeometry,
      GeomColName: geomColName,
      GeometryType: geomType,
      CRS: geomCRS,
    };

    return results;
  }

  async function getDataRecords(dataInfo) {
    const datatableRecords = await getNonSpatialRecords(dataInfo, "ALL");
    let mapRecords;
    if (dataInfo.HasGeometry) {
      mapRecords = await getSpatialRecords(dataInfo, "ALL");
    }

    return {
      TableRecords: datatableRecords,
      MapRecords: mapRecords,
      TableName: dataInfo.TableName,
    };
  }

  // 21Feb2025

  // 21Feb2025
  async function getExecutedBlockDataInfo() {
    if (doDisconnectedBlocksExistInWorkspace()) {
      const message =
        "<strong></strong>Unable to save!</strong> </br> There are " +
        numOfDisconnectedBlocks +
        " disconnected blocks. </br> There can be only one block or one connected sequence of blocks.";
      displayAlert(message);
      return;
    }

    let dataInfo;
    let workspaceBlocks = mBlocklyWorkspace.topBlocks;
    const lastBlock = workspaceBlocks[workspaceBlocks.length - 1];
    const headBlock = getHeadBlock();
    if (lastBlock.data.BlockType === mBlockTypes.Viz) {
      dataInfo = await executeVizBlock(headBlock);
    } else {
      dataInfo = await executeQueryBlock(headBlock);
    }

    return dataInfo;
  }

  // 20Feb2025
  async function executeBlockCodeNew() {
    const dataInfo = await getExecutedBlockDataInfo();

    mCurrentViewData = await getDataRecords(dataInfo);
    mCurrentViewData.DataInfo = dataInfo; // 24Feb2025

    addDataToResultsViewNew2(dataInfo); // 24Feb2025
  }

  // 10May2024
  async function handleExecuteBlockCodeClickEvent() {
    displayLoadingIcon("divLoadingIcon"); // 18Oct2024
    await executeBlockCodeNew(); // 20Feb2025
    hideLoadingIcon("divLoadingIcon"); // 21Feb2025
  }

  // 09May2024
  function handleDatasetCheckboxClickEvent(evt) {
    const elemID = $(this).find("input[type=checkbox]").attr("id");
    const isChecked = $(this).find("input[type=checkbox]").prop("checked");
    const id = Number(elemID.split("_")[1]);
    const columnName = $(this).find("label").text();

    const dataset = mDatasetList.find(function (d) {
      return d.ID === id;
    });

    if (isChecked) {
      dataset.SelColumnsList.push(columnName);
    } else {
      dataset.SelColumnsList.splice(
        dataset.SelColumnsList.indexOf(columnName),
        1
      );
    }
  }

  // 15Jun2025 function addRemoteDatasetToPanel(dataset) {
  function addDatasetToPanel(dataset) {
    const datasetCompiledTemplateHTML = Handlebars.compile(DatasetTemplateHTML);
    const datasetGeneratedHTML = datasetCompiledTemplateHTML(dataset);
    $("#divDatasets").append(datasetGeneratedHTML);
  }

  // 21Jun2024
  function addBlockDatasetToPanel(dataset) {
    const blockDatasetCompiledTemplateHTML = Handlebars.compile(
      BlockDatasetTemplateHTML
    );
    const datasetGeneratedHTML = blockDatasetCompiledTemplateHTML(dataset);
    $("#divDatasets").append(datasetGeneratedHTML);
  }

  // 23Jul2024
  function addWorkflowStepToWorkflowPanel(workflowStep, workflowID) {
    const workflowStepCompiledTemplateHTML = Handlebars.compile(
      WorkflowStepTemplateHTML
    );
    const config = $.extend(true, {}, workflowStep);
    // add properties ShowBlockIcon from workflowStep.BlockDataset object to config
    config.ShowLineIcon = workflowStep.BlockDataset.ShowLineIcon || false;
    config.ShowPolygonIcon = workflowStep.BlockDataset.ShowPolygonIcon || false;
    config.ShowPointIcon = workflowStep.BlockDataset.ShowPointIcon || false;
    config.ShowTableIcon = workflowStep.BlockDataset.ShowTableIcon || false;
    config.HasGeometry = workflowStep.BlockDataset.HasGeometry || false;
    config.IsStepNumberGTOne = workflowStep.Number > 1;
    config.EditWorkflowFlag = mEditWorkflowFlag; // 20Sep2024
    const stepGeneratedHTML = workflowStepCompiledTemplateHTML(config);
    // 10Mar2025 $("#divWorkflowSteps").append(stepGeneratedHTML);
    // Find the correct workflow container by ID
    const $workflowContainer = $(`#wf_${workflowID}`);

    // Make sure the workflow container exists
    if ($workflowContainer.length > 0) {
      // Find the divWorkflowSteps within this specific workflow
      const $workflowStepsContainer =
        $workflowContainer.find("#divWorkflowSteps");

      // Append the step HTML to the container
      if ($workflowStepsContainer.length > 0) {
        $workflowStepsContainer.append(stepGeneratedHTML);
      } else {
        console.error(
          `Could not find #divWorkflowSteps within workflow ID ${workflowID}`
        );
      }
    } else {
      console.error(
        `Could not find workflow container with ID wf_${workflowID}`
      );
    }
  }

  // 19Jan2025
  function createResultsMap() {
    const config = {
      MapContainerID: "results_map",
      MapTooltipElemID: "mapTooltip",
    };
    $("#results_map").empty(); // 13Aug2024
    mResultsMap = new ResultsMap();
    mMediator.registerComponent("resultsmap", mResultsMap);
    mResultsMap.init(config);
  }

  // 31Aug2024
  async function createPreviewMap(mapConfig) {
    $("#preview_map").empty(); // 13Aug2024
    mPreviewMap = new PreviewMap();
    mPreviewMap.init(mapConfig);
    mPreviewMap.addVectorLayer(mapConfig);
  }

  // 13Aug2024
  function createDataTable(tableConfig) {
    mResultsTable = new DisplayTable();
    mMediator.registerComponent("resultstable", mResultsTable);
    mResultsTable.init(tableConfig);
  }

  async function loadQ1() {
    // ? modified q5 query to include the geometry of the neighborhood  // 03Apr2024
    // ? What are all the neighborhoods served by the 6-train? // ST_Contains, strpos
    // ? Original PostGIS query from https://postgis.net/workshops/postgis-intro/joins_exercises.html
    // SELECT DISTINCT n.name, n.boroname
    // FROM nyc_subway_stations AS s
    // JOIN nyc_neighborhoods AS n
    // ON ST_Contains(n.geom, s.geom)
    // WHERE strpos(s.routes,'6') > 0;
    const spatialQuery =
      "Create Table tblQ1 As Select DISTINCT n.name, n.geometry, n.boroname FROM read_parquet('" +
      mNYCSubwayStationsDataURL +
      "') AS s JOIN read_parquet('" +
      mNYCNeighborhoodsDataURL +
      "') AS n ON ST_Contains(ST_GeomFromWKB(n.geometry), ST_GeomFromWKB(s.geometry)) WHERE strpos(s.routes,'6') > 0";

    // ? Delete pre-existing table if it exists
    await mDBConn.query("DROP TABLE IF EXISTS tblQ1");
    await mDBConn.query("DROP TABLE IF EXISTS tblGeometries");

    await mDBConn.query(spatialQuery);

    const fromProj = "EPSG:26918";
    const toProj = "EPSG:3857";

    const resultsQuery =
      "Create Table tblGeometries As SELECT name, boroname, ST_AsGeoJSON(ST_Transform(ST_GeomFromWKB(geometry),'" +
      fromProj +
      "','" +
      toProj +
      "')) As geom FROM tblQ1"; // ? Reprojection 04Apr2024
    await mDBConn.query(resultsQuery);
    const result = await mDBConn.query("SELECT * FROM tblGeometries");
    const dataArr = result.toArray().map(Object.fromEntries);
  }

  // 24Apr2024
  async function loadQ2() {
    // ? What is the population and racial make-up of the neighborhoods of Manhattan? // ST_Intersects
    // ? Original PostGIS query from https://postgis.net/workshops/postgis-intro/joins.html
    // SELECT  neighborhoods.name AS neighborhood_name,
    //   Sum(census.popn_total) AS population,
    //   100.0 * Sum(census.popn_white) / Sum(census.popn_total) AS white_pct,
    //   100.0 * Sum(census.popn_black) / Sum(census.popn_total) AS black_pct
    // FROM nyc_neighborhoods AS neighborhoods
    // JOIN nyc_census_blocks AS census
    // ON ST_Intersects(neighborhoods.geom, census.geom)
    // WHERE neighborhoods.boroname = 'Manhattan'
    // GROUP BY neighborhoods.name
    // ORDER BY white_pct DESC;
    const q2 =
      "Create Table tblQ2 As Select neighborhoods.name As neighborhood_name, Sum(census.popn_total) As population, 100.0 * Sum(census.popn_white) / Sum(census.popn_total) As white_pct, 100.0 * Sum(census.popn_black) / Sum(census.popn_total) As black_pct FROM read_parquet('" +
      mNYCNeighborhoodsDataURL +
      "') As neighborhoods JOIN read_parquet('" +
      mNYCCensusBlocksDataURL +
      "') AS census ON ST_Intersects(ST_GeomFromWKB(neighborhoods.geometry), ST_GeomFromWKB(census.geometry)) WHERE neighborhoods.boroname = 'Manhattan' GROUP BY neighborhoods.name ORDER BY white_pct DESC";

    // ? Delete pre-existing table if it exists
    await mDBConn.query("DROP TABLE IF EXISTS tblQ2");

    await mDBConn.query(q2);
    const result = await mDBConn.query("SELECT * FROM tblQ2");

    const dataArr = result
      .toArray()
      .map(Object.fromEntries)
      .map(function (d) {
        return {
          neighborhood_name: d.neighborhood_name,
          population: d.population[0],
          white_pct: d.white_pct,
          black_pct: d.black_pct,
        };
      });
    const columnNames = Object.keys(dataArr[0]);
    const columnsList = columnNames.map(function (d, i) {
      return { ColumnID: i + 1, ColumnName: d };
    });

    const tableConfig = {
      TableContainerID: "results_table",
      TableID: "tblQueryResults",
      ColumnsList: columnsList,
      TableData: dataArr,
    };

    const newTable = new DisplayTable();
    newTable.init(tableConfig);
  }

  // 15Apr2024
  function loadQuery(queryInfo) {
    const queryObj = {
      q1: loadQ1,
      q2: loadQ2,
    };
    queryObj[queryInfo.ID]();
  }

  // 15Apr2024
  function handleQuerySelectClickEvent(evt) {
    const queryID = $(evt.target).attr("id");
    const queryInfo = mQueryList.find(function (d) {
      return d.ID === queryID;
    });

    $("#divQueryInfo").empty();
    $("#divQueryInfo").append(queryInfo.SQL);
    $("#btnSelectQuery").text(queryInfo.Question);

    if (queryInfo.ReturnType === "table") {
      $("#results_map").empty();
      $("#results_map").hide();
      $("#results_table").empty();
      $("#results_table").show();
    }

    if (queryInfo.ReturnType === "map") {
      $("#results_table").empty();
      $("#results_table").hide();
      $("#results_map").empty();
      $("#results_map").show();
    }

    loadQuery(queryInfo);
  }

  function handleDeleteDatasetClickEvent(evt) {
    const elemID = $(evt.target).attr("id");
    // 20Jun2024 const id = Number(elemID.split("_")[1]);
    const id = elemID.split("_")[1]; // 20Jun2024

    // ? Remove preview table info
    const previewTableInfo = mDatasetPreviewTablesList.find(function (d) {
      return d.ID === id;
    });
    if (previewTableInfo) {
      mDatasetPreviewTablesList = mDatasetPreviewTablesList.filter(
        function (d) {
          return d.ID !== previewTableInfo.ID;
        }
      );
    }

    // ? Remove Data Source
    const dataset = mDatasetList.find(function (d) {
      return d.ID === id;
    });
    if (dataset) {
      mDatasetList = mDatasetList.filter(function (d) {
        return d.ID !== dataset.ID;
      });
    }

    // Delete Data Source from panel
    if (dataset.Origin === mDatasetOriginTypes.Remote) {
      $("#divRemoteDataset_" + id).remove();
    } else if (dataset.Origin === mDatasetOriginTypes.Block) {
      $("#divBlockDataset_" + id).remove();
    }

    // Empty preview table
    updateBlocks(); // 14Sep2024
  }

  // 07Jan2025
  async function getRecordCountFromFileURL(datasetURL, dataType) {
    let countQuery;

    if (dataType.toUpperCase() === "PARQUET") {
      countQuery =
        "SELECT COUNT(*) AS count FROM read_parquet('" + datasetURL + "')";
    }

    if (dataType.toUpperCase() === "CSV") {
      countQuery =
        "SELECT COUNT(*) AS count FROM read_csv_auto('" + datasetURL + "')";
    }

    if (dataType.toUpperCase() === "JSON") {
      countQuery =
        "SELECT COUNT(*) AS count FROM read_json_auto('" + datasetURL + "')";
    }

    if (dataType.toUpperCase() === "GEOJSON") {
      countQuery =
        "SELECT COUNT(*) AS count FROM ST_Read('" + datasetURL + "')";
    }

    const countResult = await mDBConn.query(countQuery);
    const count = countResult.toArray()[0].count;
    return count;
  }

  // 19Dec2024
  const getFilenameWithExtension = (url) => {
    return url.substring(url.lastIndexOf("/") + 1);
  };

  // 18Dec2024
  async function getColumnsListFromCSV(datasetURL) {
    const schemaQuery = `DESCRIBE (SELECT * FROM read_csv_auto('${datasetURL}') LIMIT 0);`;
    const schema = await mDBConn.query(schemaQuery);
    const schemaDataArr = schema.toArray().map(Object.fromEntries);
    const columnsList = schemaDataArr.map(function (d, i) {
      return {
        ColumnID: i + 1,
        ColumnName: d.column_name,
        ColumnType: d.column_type,
      };
    });
    return columnsList;
  }

  // 14Feb2025
  async function getCRSFromParquet(datasetURL) {
    const q = `SELECT ((decode(value))::JSON).columns.geometry as col FROM parquet_kv_metadata('${datasetURL}') where key = 'geo';`; // 16Feb2025
    const result = await mDBConn.query(q);
    const jsonString = result.toString();

    // 16Feb2025

    // ? the JSON returned by Duckdb is malformed  // 16Feb2025
    const cleanedStr1 = jsonString.replace('"{"encoding"', '{"encoding"');
    const cleanedStr2 = cleanedStr1.replace('"}\n]', "}]");
    // console.log(cleanedStr2);
    const json = JSON.parse(cleanedStr2);
    try {
      if (json[0].col) {
        const col = json[0].col;
        const crs = col.crs.id ? col.crs.id : col.crs.source_crs.id;
        const crsDef = `${crs.authority}:${crs.code}`;
        return crsDef;
      }
    } catch (e) {
      throw new Error("Failed to parse CRS info from JSON");
    }
    return null;
  }

  // 18Dec2024
  async function getColumnsListFromParquet(datasetURL) {
    const schemaQuery = "DESCRIBE TABLE '" + datasetURL + "';";
    const schema = await mDBConn.query(schemaQuery);
    const schemaDataArr = schema.toArray().map(Object.fromEntries);
    const columnsList = schemaDataArr.map(function (d, i) {
      return {
        ColumnID: i + 1,
        ColumnName: d.column_name,
        ColumnType: d.column_type,
      };
    });
    return columnsList;
  }

  // 19Dec2024
  async function getColumnsListFromJSON(datasetURL) {
    const schemaQuery = `DESCRIBE (SELECT * FROM read_json_auto('${datasetURL}') LIMIT 0);`;
    const schema = await mDBConn.query(schemaQuery);
    const schemaDataArr = schema.toArray().map(Object.fromEntries);
    const columnsList = schemaDataArr.map(function (d, i) {
      return {
        ColumnID: i + 1,
        ColumnName: d.column_name,
        ColumnType: d.column_type,
      };
    });
    return columnsList;
  }

  // 02Feb2025
  // get columns list from geojson url
  async function getColumnsListFromGeoJson(datasetURL) {
    // ? The method used here is different from the function getGeomTypeFromUrl() because we need the column names that are in the original GeoJSON file when loading the geojson data into the Duckdb table.
    try {
      // Step 1: Load the GeoJSON data
      const geojsonData = await load(datasetURL, _GeoJSONLoader);

      // Step 2: Extract features and their properties
      const features = geojsonData.features;
      if (!features || features.length === 0) {
        throw new Error("No features found in the GeoJSON data");
      }

      // Step 3: Identify the geometry property name
      const geometryPropName =
        Object.keys(features[0]).find(
          (key) =>
            features[0][key] &&
            features[0][key].type &&
            features[0][key].coordinates
        ) || "geometry";

      // Step 4: Create a temporary table with the properties of the first feature
      const properties = features[0].properties;
      const columns = Object.keys(properties)
        .map((key) => `"${key}" VARCHAR`)
        .join(", ");
      await mDBConn.query(`CREATE TEMP TABLE geojson_table (${columns})`);

      // Step 5: Insert data into the temporary table
      for (const feature of features) {
        const values = Object.values(feature.properties)
          .map((val) => `'${val}'`)
          .join(", ");
        await mDBConn.query(`INSERT INTO geojson_table VALUES (${values})`);
      }

      // Step 6: Get the schema of the created table
      const schemaQuery = `DESCRIBE geojson_table`;
      const schema = await mDBConn.query(schemaQuery);
      const schemaDataArr = schema.toArray().map(Object.fromEntries);

      // Step 7: Format the column list
      const columnsList = schemaDataArr.map((d, i) => ({
        ColumnID: i + 1,
        ColumnName: d.column_name,
        ColumnType: d.column_type,
      }));

      // Step 8: Add the geometry column
      columnsList.push({
        ColumnID: columnsList.length + 1,
        ColumnName: geometryPropName,
        ColumnType: "GEOMETRY",
      });

      // Step 9: Clean up - drop the temporary table
      await mDBConn.query(`DROP TABLE IF EXISTS geojson_table`);

      return columnsList;
    } catch (error) {
      console.error("Error processing GeoJSON:", error);
      throw error;
    }
  }

  // 01Feb2025
  async function getUrlInfo(url) {
    try {
      // Step 1: Check for file extensions
      const fileExtensions = [".parquet", ".csv", ".json", ".geojson", ".xml"];
      // Step1: check the url for the extension type and check if the extension is in the fileExtensions list
      const fileExtension = url.substring(url.lastIndexOf("."));
      if (fileExtensions.includes(fileExtension)) {
        // 13Feb2025 console.log("The URL likely points to a file based on its extension.");
        return { Type: mUrlTypes.File, DataType: fileExtension.slice(1) };
      }

      // Step 2: Make a HEAD request to check Content-Type
      const response = await fetch(url, { method: "HEAD" });
      const contentType = response.headers.get("content-type");

      // Step 3: Analyze Content-Type
      if (contentType.includes("application/json")) {
        // 13Feb2025 console.log("The URL points to a web API returning JSON.");
        return { Type: mUrlTypes.WebApi, DataType: "json" };
      } else if (
        contentType.includes("application/geo+json") ||
        contentType.includes("application/vnd.geo+json")
      ) {
        return { Type: mUrlTypes.WebApi, DataType: "geojson" };
      } else if (contentType.includes("text/csv")) {
        return { Type: mUrlTypes.WebApi, DataType: "csv" };
      } else if (
        contentType.includes("application/xml") ||
        contentType.includes("text/xml")
      ) {
        return { Type: mUrlTypes.WebApi, DataType: "xml" };
      } else if (
        contentType.includes("application/octet-stream") ||
        contentType.includes("parquet")
      ) {
        // 13Feb2025 console.log("The URL points to a binary file (e.g., Parquet).");
        return { Type: mUrlTypes.Binary, DataType: "parquet" };
      } else {
        console.log(`Unknown type: ${contentType}`);
        return { Type: "unknown" };
      }
    } catch (error) {
      console.error("Error checking URL:", error);
      return "error";
    }
  }

  // 07Jan2025
  async function getRemoteDatasetInfo(datasetURL) {
    let datasetInfo;

    const urlInfo = await getUrlInfo(datasetURL);

    // ? file
    if (urlInfo.Type === mUrlTypes.File) {
      datasetInfo = {
        UrlType: urlInfo.Type,
        // DataType: dataType,
        DataType: urlInfo.DataType,
        CRS: await getCRSFromFileURL(datasetURL, urlInfo.DataType),
        ColumnsList: await getColumnsListFromFileURL(
          datasetURL,
          urlInfo.DataType
        ),
        RecordCount: await getRecordCountFromFileURL(
          datasetURL,
          urlInfo.DataType
        ),
      };
    }

    // ? web api
    if (urlInfo.Type === mUrlTypes.WebApi) {
      // add try catch block to this if block
      try {
        if (urlInfo.DataType === "json") {
          const response = await fetch(datasetURL);
          const jsonData = await response.json();

          datasetInfo = {
            UrlType: urlInfo.Type,
            DataType: urlInfo.DataType,
            Data: jsonData,
          };
        }
      } catch (error) {
        console.error("Error fetching JSON data:", error);
      }
    }

    return datasetInfo;
  }

  async function getCRSFromFileURL(datasetURL, dataType) {
    let crs;
    let crsDef;
    if (dataType.toUpperCase() === "PARQUET") {
      crsDef = await getCRSFromParquet(datasetURL);
    }
    // TODO: Add support for other file types
    return crsDef;
  }

  // 01May2024
  async function getColumnsListFromFileURL(datasetURL, dataType) {
    // ? 'DESCRIBE SELECT * FROM read_parquet('" + datasetURL + "')' triggers the download of the entire parquet file which is not ideal  // 27Jul2024

    let columnsList;
    if (dataType.toUpperCase() === "PARQUET") {
      // ? This works -  schemaQuery = "DESCRIBE TABLE '" + datasetURL + "';";
      columnsList = await getColumnsListFromParquet(datasetURL);
    }
    if (dataType.toUpperCase() === "CSV") {
      // ? This works -  schemaQuery = `SELECT * FROM read_csv_auto('${datasetURL}') LIMIT 0;`;
      // schemaQuery = `SELECT * FROM sniff_csv('${datasetURL}')`;
      columnsList = await getColumnsListFromCSV(datasetURL);
    }
    if (dataType.toUpperCase() === "JSON") {
      columnsList = await getColumnsListFromJSON(datasetURL); // 19Dec2024
    }

    if (dataType.toUpperCase() === "GEOJSON") {
      columnsList = await getColumnsListFromGeoJson(datasetURL); // 02Feb2025
    }

    return columnsList;
  }

  // 08Jun2024
  async function getColumnsListFromTable(tblName) {
    const schemaQuery = "DESCRIBE SELECT * FROM " + tblName + ";";
    const schema = await mDBConn.query(schemaQuery);
    const schemaDataArr = schema.toArray().map(Object.fromEntries);
    const columnsList = schemaDataArr.map(function (d, i) {
      return {
        ColumnID: i + 1,
        ColumnName: d.column_name,
        ColumnType: d.column_type,
      };
    });

    return columnsList;
  }

  // 19Aug2024
  async function getRecordCountFromTable(tblName) {
    const countQuery = "SELECT COUNT(*) AS count FROM " + tblName;
    const countResult = await mDBConn.query(countQuery);
    const count = countResult.toArray()[0].count;
    return count;
  }

  // 01May2024
  async function getGeomTypeFromUrl(datasetURL, dataType, geomColName) {
    let geomType = null; // 26Jul2024

    // 03Feb2025
    const readFunctionTypes = {
      GEOJSON: "ST_Read",
      PARQUET: "read_parquet",
    };
    const readFunction = readFunctionTypes[dataType.toUpperCase()];

    try {
      // For other data types, use the provided geomColName
      const geomTypeQuery = `SELECT ST_GeometryType(${geomColName}) As geom_type FROM ${readFunction}('${datasetURL}') LIMIT 1;`;
      const geomTypeResult = await mDBConn.query(geomTypeQuery);
      const geomTypeDataArr = geomTypeResult.toArray().map(Object.fromEntries);
      if (geomTypeDataArr.length > 0) {
        geomType = geomTypeDataArr[0].geom_type;
      }
    } catch (error) {
      console.error("Error in getGeomTypeFromUrl:", error);
    }

    return geomType;
  }

  // 01Sep2024
  async function getGeomCRSFromURL(datasetURL) {
    // ? This does not return anything
    let geomCRS;
    const query = `SELECT ST_read_meta('${datasetURL}') AS metadata`;
    const result = await conn.query(query);
    geomCRS = result.get(0).crs;
    return geomCRS;
  }

  // 11Feb2025
  async function createDatasetData(dataset) {
    let q;
    const tableName = `tbl_${dataset.ID}`; // ? short GUID
    const readFunctionTypes = {
      CSV: "read_csv_auto",
      JSON: "read_json_auto",
      GEOJSON: "ST_Read",
      PARQUET: "read_parquet",
    };
    if (dataset.Origin === mDatasetOriginTypes.Remote) {
      const readFunction = readFunctionTypes[dataset.DatasetType.toUpperCase()];
      q = `CREATE OR REPLACE Table ${tableName} AS SELECT * FROM ${readFunction}('${dataset.Url}');`; // ? 'All' records
    } else if (dataset.Origin === mDatasetOriginTypes.Local) {
      const readFunction = readFunctionTypes[dataset.DatasetType.toUpperCase()];
      q = `CREATE OR REPLACE Table ${tableName} AS SELECT * FROM ${readFunction}('${dataset.File.name}');`; // ? 'All' records
    } else if (dataset.Origin === mDatasetOriginTypes.Block) {
      q = `CREATE OR REPLACE Table ${tableName} AS SELECT * FROM ${dataset.TableName};`; // ? All records
    }
    await mDBConn.query(q);

    // ? Create an R-tree spatial index on the geometry column,  // 13Feb2025
    if (dataset.HasGeometry) {
      const geomColName = getGeomColName(dataset.ColumnsList); // 13Feb2025
      q = `CREATE INDEX idx_${tableName}_${geomColName} ON ${tableName} USING RTREE (${geomColName});`; // 13Feb2025
      await mDBConn.query(q);
    }
  }

  // 11Feb2025
  async function getDatasetDataNew(dataset, tableName, limit = "100") {
    let q;

    if (limit !== "ALL") {
      q = `CREATE OR REPLACE Table ${tableName} AS SELECT * FROM ${dataset.TableName} LIMIT ${limit};`;
    } else {
      q = `CREATE OR REPLACE Table ${tableName} AS SELECT * FROM ${dataset.TableName};`; // ? All records
    }

    await mDBConn.query(q);

    let tableQuery;
    if (dataset.HasGeometry) {
      tableQuery = `SELECT * EXCLUDE(${dataset.GeomColName}) FROM ${tableName}`; // ? spatial 05Feb2025
    } else {
      tableQuery = `SELECT * FROM ${tableName}`; // ? non-spatial
    }
    const result = await mDBConn.query(tableQuery);
    const dataArr = result.toArray().map(Object.fromEntries);

    return dataArr;
  }

  // ?  // 20Feb2025
  async function getNonSpatialRecords(dataset, limit = "100") {
    const geometryColumns = getAllGeomColNames(dataset.ColumnsList);

    // Construct the SELECT part of the query
    let selectPart;
    if (geometryColumns.length > 0) {
      const excludeGeometryColumns = geometryColumns.join(", ");
      selectPart = `* EXCLUDE(${excludeGeometryColumns})`;
    } else {
      selectPart = "*";
    }

    // Construct the full query
    let q = `SELECT ${selectPart} FROM ${dataset.TableName}`;

    if (limit !== "ALL") {
      q += ` LIMIT ${limit}`;
    }

    const result = await mDBConn.query(q);
    const dataArr = result.toArray().map(Object.fromEntries);

    return dataArr;
  }

  // ? // 20Feb2025
  async function getSpatialRecords(dataset, limit = "100") {
    // Construct the SELECT part of the query
    const geometryColumns = getAllGeomColNames(dataset.ColumnsList);

    const excludeGeometryColumns = geometryColumns.join(", ");
    const selectPart = `* EXCLUDE(${excludeGeometryColumns}), ST_AsWKB(ST_Transform(${dataset.GeomColName},'${dataset.CRS}','EPSG:3857')) As wkb `;

    // Construct the full query
    let q = `SELECT ${selectPart} FROM ${dataset.TableName}`;

    if (limit !== "ALL") {
      q += ` LIMIT ${limit}`;
    }

    const result = await mDBConn.query(q);
    const dataArr = result.toArray().map(Object.fromEntries);

    return dataArr;
  }

  // 14Jun2024
  function handleCloseDatasetPreviewModalEvent() {
    const modalEl = document.getElementById("divDatasetPreviewPanel");
    $("#preview_map").empty();
    $("#preview_table").empty();
    $("#iconDatasetPreview")
      .removeClass("bi-eye-slash-fill")
      .addClass("bi-eye-fill"); // 17May2024
    // 31Aug2024 $("#divDatasetPreview").empty();
    modalEl.removeEventListener(
      "hide.bs.modal",
      handleCloseDatasetPreviewModalEvent
    );
  }

  async function handleWorkflowStepPreviewClickEvent(evt) {
    const elemID = $(evt.currentTarget).attr("id");
    const workflowStepID = elemID.split("_")[1];
    const workflowElem = $(this).closest(".accordion");
    const workflowID = workflowElem.attr("id").split("_")[1];
    const workflow = mWorkflowsList.find(function (d) {
      return d.ID === workflowID;
    });
    const workflowStep = workflow.Steps.find(function (d) {
      return d.ID === workflowStepID;
    });

    mPreviewDataset = workflowStep.BlockDataset;
    displayDatasetPreview();
  }

  // 31Aug2024
  function addNumOfRecordsPreviewChangeEventHandler() {
    document.getElementById("selectNumOfRecords").onchange = function () {
      const numOfRecords = this.value;
      handleChangePreviewNumOfRecords(numOfRecords);
    };
  }

  // 31Aug2024
  function activatePreviewMapView() {
    mPreviewVizView = "Map";
    $("#preview_map").removeClass("d-none");
    $("#radBtnPreviewMap").prop("checked", true);
    deactivatePreviewDataTableView(); // 20Aug2024
  }

  // 31Aug2024
  function activatePreviewDataTableView() {
    mPreviewVizView = "DataTable";
    $("#preview_table").removeClass("d-none");
    $("#radBtnPreviewDataTable").prop("checked", true);
    deactivatePreviewMapView();
  }

  // 31Aug2024
  function getNoGeometryColumnsList(columnsList) {
    const noGeometryColumnsList = columnsList.filter(function (column) {
      // 07Jan2025
      return (
        column.ColumnType.toUpperCase() !== "GEOMETRY" &&
        column.ColumnName !== "buffer_geometry" &&
        column.ColumnName !== "geometry_bbox"
      );
    });

    return noGeometryColumnsList;
  }

  // 31Aug2024
  async function displayDatasetPreviewViz() {
    const numOfRecords = $("#selectNumOfRecords").val();
    // ? Get the data

    // 23Jan2025
    const tableName = mPreviewDataQueryTableName;

    // 11Feb2025
    const previewTableDataArr = await getDatasetDataNew(
      mPreviewDataset,
      tableName,
      numOfRecords
    );

    const noGeometryColumnsList = getNoGeometryColumnsList(
      mPreviewDataset.ColumnsList
    );

    // ? Check if data is spatial,  // 11Feb2025
    const isSpatialData = hasGeometryColumn(mPreviewDataset.ColumnsList);

    // 11Feb2025
    if (!isSpatialData) {
      $("#radBtnPreviewMap").prop("disabled", true);
    } else {
      $("#radBtnPreviewMap").prop("disabled", false);
    }

    if (isSpatialData && mPreviewVizView === "Map") {
      // 12Feb2025
      const geomColNameArr = getAllGeomColNames(mPreviewDataset.ColumnsList); // ? some datasets might contain multiple geometry columns when it is created by combining two spatial datasets
      // ? create a comma separated list of geometry column names
      const geomColNamesStr = geomColNameArr.join(", ");

      // 11Feb2025
      let querySQL;
      const geomColName = getGeomColName(mPreviewDataset.ColumnsList); // 10Jan2025
      const geomCRS = mPreviewDataset.CRS;
      const geomType = mPreviewDataset.GeomType; // 13Feb2025

      querySQL = `SELECT * EXCLUDE(${geomColNamesStr}), ST_AsWKB(ST_Transform(${geomColName},'${geomCRS}','EPSG:3857')) As wkb FROM ${mPreviewDataQueryTableName}`; // ? Binary format, 05Feb2025 // 12Feb2025

      // 15Aug2024
      const result = await mDBConn.query(querySQL);
      const mapFeaturesArr = result.toArray().map(Object.fromEntries);

      const mapConfig = {
        MapContainerID: "preview_map",
        MapTooltipElemID: "preview_mapTooltip",
        LayerName: "Preview Layer",
        MapFeatures: mapFeaturesArr, // 05Feb2025
        GeometryType: mPreviewDataset.GeometryType, // 13Feb2025
      };

      $(function () {
        activatePreviewMapView();
        createPreviewMap(mapConfig);
      });
    } else {
      // ? DATA TABLE
      activatePreviewDataTableView();
      deactivatePreviewMapView();

      const tableConfig = {
        TableContainerID: "preview_table",
        TableID: "tblQueryPreview",
        ColumnsList: noGeometryColumnsList,
        TableData: previewTableDataArr,
      };
      createDataTable(tableConfig);
    }
  }

  /*  // 17May2025
  // 07Sep2024
   async function loadAndRenderWorkspace(workspaceJson, containerId) {
    if (typeof Blockly === "undefined") {
      console.error("Blockly is not loaded. Please include Blockly library.");
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id "${containerId}" not found.`);
      return;
    }

    const workspace = Blockly.inject(container, {
      readOnly: true,
      scrollbars: true, // Initially enable scrollbars
      zoom: {
        controls: false,
        wheel: false,
        startScale: 1.0,
        maxScale: 1.0,
        minScale: 1.0,
      },
    });

    try {
      Blockly.serialization.workspaces.load(
        JSON.parse(workspaceJson),
        workspace
      );

      // Function to resize and hide scrollbars
      const resizeAndHideScrollbars = () => {
        const metrics = workspace.getMetrics();
        const padding = 20;
        const width = metrics.contentWidth + padding * 2;
        const height = metrics.contentHeight + padding * 2;

        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        console.log("Width: ", width, ", Height: ", height); // 17May2025
        Blockly.svgResize(workspace);
        workspace.scrollCenter();

        $(".blocklyMainWorkspaceScrollbar").remove(); // 07Sep2024
      };

      // Resize and hide scrollbars after a short delay
      setTimeout(resizeAndHideScrollbars, 100);

      // Add a mutation observer to handle dynamic changes
      const observer = new MutationObserver(resizeAndHideScrollbars);
      observer.observe(container, { childList: true, subtree: true });
    } catch (error) {
      console.error("Error loading workspace:", error);
    }
  } */

  // 17May2025
  async function loadAndRenderWorkspace(workspaceJson, containerId) {
    if (typeof Blockly === "undefined") {
      console.error("Blockly is not loaded. Please include Blockly library.");
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id "${containerId}" not found.`);
      return;
    }

    const workspace = Blockly.inject(container, {
      readOnly: true,
      scrollbars: true, // Initially enable scrollbars
      zoom: {
        controls: false,
        wheel: false,
        startScale: 1.0,
        maxScale: 1.0,
        minScale: 1.0,
      },
    });

    try {
      Blockly.serialization.workspaces.load(
        JSON.parse(workspaceJson),
        workspace
      );

      // Function to resize and hide scrollbars
      const resizeAndHideScrollbars = () => {
        const metrics = workspace.getMetrics();
        const padding = 20;
        const width = metrics.contentWidth + padding * 2;
        const height = metrics.contentHeight + padding * 2;

        container.style.width = `${width}px`;
        container.style.height = `${height}px`;

        // Force a resize of the SVG before removing scrollbars
        Blockly.svgResize(workspace);

        // Wait for the resize to take effect before removing scrollbars
        setTimeout(() => {
          $(".blocklyMainWorkspaceScrollbar").remove();
          workspace.scrollCenter();
        }, 100);
      };

      // Give more time for the workspace to fully render before calculating metrics
      setTimeout(resizeAndHideScrollbars, 100);

      // Add a mutation observer to handle dynamic changes
      // Add a mutation observer to handle dynamic changes
      const observer = new MutationObserver(() => {
        setTimeout(resizeAndHideScrollbars, 100);
      });
      observer.observe(container, { childList: true, subtree: true });
    } catch (error) {
      console.error("Error loading workspace:", error);
    }
  }

  /*  // 17May2025
  // 25Jul2024
  async function displayDatasetPreview() {
    const modalEl = document.getElementById("divDatasetPreviewPanel");
    const modal = new bootstrap.Modal(modalEl);

    $("#iconDatasetPreview")
      .removeClass("bi-eye-fill")
      .addClass("bi-eye-slash-fill"); // 17May2024

    // 28Jul2024
    let geomInfo;
    if (mPreviewDataset.HasGeometry) {
      geomInfo =
        "<p><span class='fw-bold'>Geometry Type: </span><span>" +
        mPreviewDataset.GeometryType +
        "</span></p>" +
        "<p><span class='fw-bold'>CRS: </span><span>" +
        mPreviewDataset.CRS +
        "</span></p>";
    } else {
      geomInfo =
        "<p><span class='fw-bold'>Geometry Type: </span><span>N/A</span></p>"; // 07Jan2025
    }

    // ? TODO: Convert this to HTML template
    let datasetInfo;
    if (mPreviewDataset.Origin === mDatasetOriginTypes.Remote) {
      datasetInfo =
        "<p><span class='fw-bold'>ID: </span><span>" +
        mPreviewDataset.ID +
        "</span></p>" +
        "<p><span class='fw-bold'>Name: </span><span>" +
        mPreviewDataset.Name +
        "</span></p>" +
        "<p><span class='fw-bold'>Total Records: </span><span>" +
        mPreviewDataset.RecordCount +
        "</span><span class='fw-bold ms-3'> Display Records: </span><select name='numOfRecords' id='selectNumOfRecords'><option value='100'>100</option><option value='1000'>1000</option><option value='all'>All</option></select></p>" +
        geomInfo +
        "<p><span class='fw-bold'>Url: </span><span>" +
        mPreviewDataset.Url +
        "</span></p>" +
        "<p><span class='fw-bold'>Origin: </span><span>" +
        mPreviewDataset.Origin +
        "</span></p>" +
        "<p><span class='fw-bold'>Url Type: </span><span>" +
        mPreviewDataset.UrlType +
        "</span></p>" +
        "<p><span class='fw-bold'>Description: </span>" +
        mPreviewDataset.Description +
        "<span></span></p>";
    } else if (mPreviewDataset.Origin === mDatasetOriginTypes.Block) {
      datasetInfo =
        "<p><span class='fw-bold'>ID: </span><span>" +
        mPreviewDataset.ID +
        "</span></p>" +
        "<p><span class='fw-bold'>Name: </span><span>" +
        mPreviewDataset.Name +
        "</span></p>" +
        "<p><span class='fw-bold'>Total Records: </span><span>" +
        mPreviewDataset.RecordCount +
        "</span><span class='fw-bold ms-3'> Display Records: </span><select name='numOfRecords' id='selectNumOfRecords'><option value='100'>100</option><option value='1000'>1000</option><option value='all'>All</option></select></p>" +
        geomInfo +
        "<p><span class='fw-bold'>TableName: </span><span>" +
        mPreviewDataset.TableName +
        "</span></p>" +
        "<p><span class='fw-bold'>SQL: </span><span>" +
        mPreviewDataset.SQLCode +
        "</span></p>" +
        "<p><span class='fw-bold'>Origin: </span><span>" +
        mPreviewDataset.Origin +
        "</span></p>" +
        "<p><span class='fw-bold'>Description: </span>" +
        mPreviewDataset.Description +
        "<span></span></p>" +
        "<div id='hiddenWorkspaceDiv' style='display: none;'></div>" + // 07Sep2024
        "<div id='divDatasetPreviewWorkspace' style='min-width:200px;min-height:200px'></div>";
    }
    $("#divDatasetInfo").html(datasetInfo);

    addNumOfRecordsPreviewChangeEventHandler();

    // 17Jul2024
    if (mPreviewDataset.Origin === mDatasetOriginTypes.Block) {
      // 07Sep2024
      loadAndRenderWorkspace(
        mPreviewDataset.SerializedWorkspaceJSON,
        "divDatasetPreviewWorkspace"
      );
    }

    displayDatasetPreviewViz(); // 31Aug2024

    modalEl.addEventListener(
      "hide.bs.modal",
      handleCloseDatasetPreviewModalEvent
    );
    modal.show();
  } */

  // 17May2025
  async function displayDatasetPreview() {
    const modalEl = document.getElementById("divDatasetPreviewPanel");
    const modal = new bootstrap.Modal(modalEl);

    $("#iconDatasetPreview")
      .removeClass("bi-eye-fill")
      .addClass("bi-eye-slash-fill"); // 17May2024

    // 28Jul2024
    let geomInfo;
    if (mPreviewDataset.HasGeometry) {
      geomInfo =
        "<div class='col-md-6'><p><span class='fw-bold'>Geometry Type: </span><span>" +
        mPreviewDataset.GeometryType +
        "</span></p></div>" +
        "<div class='col-md-6'><p><span class='fw-bold'>CRS: </span><span>" +
        mPreviewDataset.CRS +
        "</span></p></div>";
    } else {
      geomInfo =
        "<div class='col-md-6'><p><span class='fw-bold'>Geometry Type: </span><span>N/A</span></p></div>"; // 07Jan2025
    }

    // ? TODO: Convert this to HTML template
    let datasetInfo;
    if (mPreviewDataset.Origin === mDatasetOriginTypes.Remote) {
      datasetInfo =
        "<div class='row'>" +
        "<div class='col-md-6'><p><span class='fw-bold'>ID: </span><span>" +
        mPreviewDataset.ID +
        "</span></p></div>" +
        "<div class='col-md-6'><p><span class='fw-bold'>Name: </span><span>" +
        mPreviewDataset.Name +
        "</span></p></div>" +
        "<div class='col-md-12'><p><span class='fw-bold'>Total Records: </span><span>" +
        mPreviewDataset.RecordCount +
        "</span><span class='fw-bold ms-3'> Display Records: </span><select name='numOfRecords' id='selectNumOfRecords'><option value='100'>100</option><option value='1000'>1000</option><option value='all'>All</option></select></p></div>" +
        geomInfo +
        "<div class='col-md-6'><p><span class='fw-bold'>Url: </span><span>" +
        mPreviewDataset.Url +
        "</span></p></div>" +
        "<div class='col-md-6'><p><span class='fw-bold'>Origin: </span><span>" +
        mPreviewDataset.Origin +
        "</span></p></div>" +
        "<div class='col-md-6'><p><span class='fw-bold'>Url Type: </span><span>" +
        mPreviewDataset.UrlType +
        "</span></p></div>" +
        "<div class='col-md-12'><p><span class='fw-bold'>Description: </span>" +
        mPreviewDataset.Description +
        "<span></span></p></div>" +
        "</div>";
    } else if (mPreviewDataset.Origin === mDatasetOriginTypes.Block) {
      datasetInfo =
        "<div class='row'>" +
        "<div class='col-md-6'><p><span class='fw-bold'>ID: </span><span>" +
        mPreviewDataset.ID +
        "</span></p></div>" +
        "<div class='col-md-6'><p><span class='fw-bold'>Name: </span><span>" +
        mPreviewDataset.Name +
        "</span></p></div>" +
        "<div class='col-md-12'><p><span class='fw-bold'>Total Records: </span><span>" +
        mPreviewDataset.RecordCount +
        "</span><span class='fw-bold ms-3'> Display Records: </span><select name='numOfRecords' id='selectNumOfRecords'><option value='100'>100</option><option value='1000'>1000</option><option value='all'>All</option></select></p></div>" +
        geomInfo +
        "<div class='col-md-6'><p><span class='fw-bold'>TableName: </span><span>" +
        mPreviewDataset.TableName +
        "</span></p></div>" +
        "<div class='col-md-6'><p><span class='fw-bold'>Origin: </span><span>" +
        mPreviewDataset.Origin +
        "</span></p></div>" +
        "<div class='col-md-12'><p><span class='fw-bold'>SQL: </span><span>" +
        mPreviewDataset.SQLCode +
        "</span></p></div>" +
        "<div class='col-md-12'><p><span class='fw-bold'>Description: </span>" +
        mPreviewDataset.Description +
        "<span></span></p></div>" +
        "</div>" +
        "<div id='hiddenWorkspaceDiv' style='display: none;'></div>" + // 07Sep2024
        "<div id='divDatasetPreviewWorkspace' style='min-width:200px;min-height:200px'></div>";
    }
    $("#divDatasetInfo").html(datasetInfo);

    addNumOfRecordsPreviewChangeEventHandler();

    // 17Jul2024
    if (mPreviewDataset.Origin === mDatasetOriginTypes.Block) {
      // 07Sep2024
      loadAndRenderWorkspace(
        mPreviewDataset.SerializedWorkspaceJSON,
        "divDatasetPreviewWorkspace"
      );
    }

    displayDatasetPreviewViz(); // 31Aug2024

    modalEl.addEventListener(
      "hide.bs.modal",
      handleCloseDatasetPreviewModalEvent
    );
    modal.show();
  }

  // 23Jan2025
  async function addDatasetToResultsView(dataset) {
    try {
      const tableName = dataset.TableName; // 26Jan2025
      const datasetDataArr = await getDatasetDataNew(dataset, tableName, "ALL"); // 11Feb2025

      // ? TODO: The code below is same as in function getBlockSQLQueryData. Make a common function
      const columnsList = dataset.ColumnsList;
      // ? Check if data is spatial,  // 11Feb2025
      const isSpatialData = hasGeometryColumn(columnsList); // 12Feb2025
      // ? remove 'geometry' column from columnsList
      const noGeometryColumnsList = getNoGeometryColumnsList(columnsList);

      // 12Feb2025
      if (!isSpatialData) {
        $("#radBtnPreviewMap").prop("disabled", true);
      } else {
        $("#radBtnPreviewMap").prop("disabled", false);
      }

      if (isSpatialData && mResultsVizView === "Map") {
        let querySQL;

        // 12Feb2025
        const geomColNameArr = getAllGeomColNames(dataset.ColumnsList); // ? some datasets might contain multiple geometry columns when it is created by combining two spatial datasets
        // ? create a comma separated list of geometry column names
        const geomColNamesStr = geomColNameArr.join(", ");
        const geomColName = getGeomColName(columnsList); // 12Feb2025
        const geomCRS = dataset.CRS; // 14Aug2024;

        querySQL = `SELECT * EXCLUDE(${geomColNamesStr}), ST_AsWKB(ST_Transform(${geomColName},'${geomCRS}','EPSG:3857')) As wkb FROM ${tableName}`; // ? Binary format, // 12Feb2025

        // 15Aug2024
        const result = await mDBConn.query(querySQL);
        const mapFeaturesArr = result.toArray().map(Object.fromEntries);
        // 05Feb2025 const geoJSONObj = createGeoJsonStructure(mapFeaturesArr);

        activateResultsMapView();

        // 20Jan2025
        const layerConfig = {
          // 11Feb2025 LayerName: tableName,
          LayerName: dataset.Name, // 11Feb2025
          // 05Feb2025  GeoJSONData: geoJSONObj
          MapFeatures: mapFeaturesArr,
          GeometryType: dataset.GeometryType, // 13Feb2025
        };
        mResultsMap.addMapLayer(layerConfig);
      } else {
        activateResultsDataTableView();
        deactivateResultsMapView();
        if (!isSpatialData && !isBufferSpatialData) {
          $("#radBtnResultsMap").prop("disabled", true);
        }
        // ? DATA TABLE
        const tableConfig = {
          TableContainerID: "results_table",
          TableID: "tblQueryResults",
          ColumnsList: noGeometryColumnsList,
          TableData: datasetDataArr,
        };
        createDataTable(tableConfig);
      }
    } catch (error) {
      console.error("Error adding dataset to map:", error);
      displayAlert("Error adding dataset to map: " + error.message);
    }
  }

  // 21Feb2025
  async function handleAddDatasetToResultsViewClickEventNew(evt) {
    const id = evt.currentTarget.id.split("_")[1];
    const dataset = mDatasetList.find((d) => d.ID === id);

    displayLoadingIcon("divAddDatasetToResultsMapLoadingIcon_" + id);

    if (!dataset) {
      displayAlert("Dataset not found.");
      return;
    }

    // ? Object destructuring, 06Mar2025
    const {
      TableName,
      Name,
      ColumnsList,
      HasGeometry,
      GeomColName,
      CRS,
      GeometryType,
      CategoryColors,
      CategoryColumn,
    } = dataset; // 06Mar2025

    // 06Mar2025
    const dataInfo = {
      TableName: TableName,
      Name: Name,
      ColumnsList: ColumnsList,
      SelColumnsList: ColumnsList, // 11Mar2025
      HasGeometry: HasGeometry,
      CategoryColors: CategoryColors,
      CategoryColumn: CategoryColumn,
    };

    if (dataset.HasGeometry) {
      Object.assign(dataInfo, {
        GeomColName: GeomColName,
        CRS: CRS,
        GeometryType: GeometryType,
      });
    }

    try {
      mCurrentViewData = await getDataRecords(dataInfo);
      mCurrentViewData.DataInfo = dataInfo; // 24Feb2025
      addDataToResultsViewNew2(dataInfo); // 24Feb2025
      hideLoadingIcon("divAddDatasetToResultsMapLoadingIcon_" + id);
    } catch (error) {
      console.error("Error fetching data:", error);
      displayAlert("Failed to add dataset. Please try again.");
    }
  }

  async function handleDatasetPreviewClickEvent(evt) {
    const elemID = $(evt.currentTarget).attr("id");
    const id = elemID.split("_")[1];

    mPreviewDataset = mDatasetList.find(function (d) {
      return d.ID === id;
    });

    // 25Jul2024
    displayDatasetPreview();
  }

  async function handleChangePreviewNumOfRecords(numOfRecords) {
    displayDatasetPreviewViz(); // 31Aug2024
  }

  // 18Aug2024
  function getLogicToolsCategory() {
    // Get the toolbox category
    const logicToolsCategory = mBlocklyToolboxContents.contents.find(
      function (d) {
        return d.toolboxitemid === "1";
      }
    );

    return logicToolsCategory;
  }

  // 19Aug2024
  function getAggregationToolsCategory() {
    // Get the toolbox category
    const aggregationToolsCategory = mBlocklyToolboxContents.contents.find(
      function (d) {
        return d.toolboxitemid === "2";
      }
    );

    return aggregationToolsCategory;
  }

  // 17May2024
  function getSpatialToolsCategory() {
    // Get the toolbox category
    const spatialToolsCategory = mBlocklyToolboxContents.contents.find(
      function (d) {
        return d.toolboxitemid === "3";
      }
    );

    return spatialToolsCategory;
  }

  // 14Feb2025
  function getDataVizToolsCategory() {
    // Get the toolbox category
    const dataVizToolsCategory = mBlocklyToolboxContents.contents.find(
      function (d) {
        return d.toolboxitemid === "4";
      }
    );
    return dataVizToolsCategory;
  }

  // 18Aug2024
  function checkIfBlockExists(blockName) {
    let categories = [
      getSpatialToolsCategory(),
      getLogicToolsCategory(),
      getAggregationToolsCategory(),
    ]; // 18Aug2024: Added logic and aggregation categories];
    return categories.some(function (category) {
      return category.contents.some(function (block) {
        return block.type === blockName;
      });
    });
  }

  // 27Sep2024
  function getBlockCustomIDIfBlockExists(blockName) {
    var categories = [
      getSpatialToolsCategory(),
      getLogicToolsCategory(),
      getAggregationToolsCategory(),
      getDataVizToolsCategory(),
    ];

    // Find the category containing the block
    var category = categories.find(function (category) {
      return category.contents.some(function (block) {
        return block.type === blockName;
      });
    });

    // If the category is found, return the block's data.CustomID
    if (category) {
      var block = category.contents.find(function (block) {
        return block.type === blockName;
      });
      if (block && block.data && block.data.CustomID) {
        return block.data.CustomID;
      }
    }

    // If the block does not exist, return null
    return null;
  }

  // 15Sep2024
  function removeBlockIfBlockExistsinToolsCategory(blockName) {
    let categories = [
      getSpatialToolsCategory(),
      getLogicToolsCategory(),
      getAggregationToolsCategory(),
      getDataVizToolsCategory(),
    ];

    // Find the category containing the block
    const category = categories.find((category) => {
      return category.contents.some((block) => block.type === blockName);
    });

    // If the category is found, remove the block from it
    if (category) {
      const blockIndex = category.contents.findIndex(
        (block) => block.type === blockName
      );

      if (blockIndex !== -1) {
        // Remove the block from the category's contents
        category.contents.splice(blockIndex, 1);

        // Get the toolbox
        const toolbox = mBlocklyWorkspace.getToolbox();

        // Find the category in the toolbox
        const toolboxCategory = toolbox.getToolboxItemById(category.id);

        if (toolboxCategory) {
          // Update the category in the toolbox
          toolboxCategory.updateFlyoutContents(category.contents);

          // Refresh the toolbox
          toolbox.refreshSelection();
        }
      }
    }
  }

  // 28Jul2024
  function hasGeometryColumn(columnsList) {
    // 11Feb2025
    return columnsList.some(function (col) {
      return col.ColumnType.toUpperCase() === "GEOMETRY";
    });
  }

  // 07Jan2025
  function getGeomColName(columnsList) {
    const geomCol = columnsList.find(function (col) {
      return col.ColumnType.toUpperCase() === "GEOMETRY";
    });
    if (geomCol) {
      return geomCol.ColumnName;
    }
    return null;
  }

  // 12Feb2025
  function getAllGeomColNames(columnsList) {
    const geomColNames = columnsList.filter(function (col) {
      return col.ColumnType.toUpperCase() === "GEOMETRY";
    });
    return geomColNames.map(function (col) {
      return col.ColumnName;
    });
  }

  // 26Aug2024
  function hasBufferGeometryColumn(columnsList) {
    return columnsList.some(function (col) {
      return col.ColumnName.toUpperCase() === "BUFFER_GEOMETRY"; //? contains at least 'BUFFER_GEOMETRY', may also contain 'GEOMETRY'
    });
  }

  // 21Aug2024
  function updateLogicBlocks() {
    createBlock1("logic_find_block", LogicFindBlock, getLogicToolsCategory); // 20Aug2024
    createBlock1("logic_where_block", LogicWhereBlock, getLogicToolsCategory);
    createBlock1("logic_andor_block", LogicAndOrBlock, getLogicToolsCategory);
    createBlock1(
      "logic_comparison_block",
      LogicComparisonBlock,
      getLogicToolsCategory
    ); // 23Feb2025
    createBlock1(
      "logic_orderby_block",
      LogicOrderByBlock,
      getLogicToolsCategory
    ); // 22Aug2024
    /*  // 07Jun2025
     createBlock1(
      "logic_data_combine_block",
      LogicDataCombineBlock,
      getLogicToolsCategory
    ); // 09Feb2025 */
  }

  // 21Aug2024
  function updateAggregationBlocks() {
    createBlock1(
      "aggregation_find_block",
      AggregationFindBlock,
      getAggregationToolsCategory
    ); // 19Aug2024

    /*  // 08Jun2025 
    createBlock1(
      "aggregation_where_block",
      AggregationWhereBlock,
      getAggregationToolsCategory
    ); */

    /*  // 08Jun2025
    createBlock1(
      "aggregation_andor_block",
      AggregationAndOrBlock,
      getAggregationToolsCategory
    ); */

    createBlock1(
      "aggregation_find_groupby_block",
      AggregationFindGroupByBlock,
      getAggregationToolsCategory
    ); // 23Aug2024
    /*  // 08Jun2025
    createBlock1(
      "aggregation_orderby_block",
      AggregationOrderByBlock,
      getAggregationToolsCategory
    ); // 23Aug2024 */

    // 07Jun2025
    createBlock1(
      "aggregation_data_combine_block",
      AggregationDataCombineBlock,
      getAggregationToolsCategory
    ); // 07Jun2025

    createBlock1(
      "aggregation_data_categorize_block",
      AggregationDataCategorizeBlock,
      getAggregationToolsCategory
    ); // 13Feb2025
  }

  // 25Aug2024
  function updateSpatialBlocks() {
    // ? Update blocks that reference a DATASET

    // 15Sep2024
    createBlock1(
      "spatial_find_join_block",
      SpatialFindJoinBlock,
      getSpatialToolsCategory
    );
    createBlock1(
      "spatial_where_block",
      SpatialWhereBlock,
      getSpatialToolsCategory
    );
    createBlock1(
      "spatial_find_buffer_block",
      SpatialFindBufferBlock,
      getSpatialToolsCategory
    );
    createBlock1(
      "spatial_find_withindistance_frompoint_block",
      SpatialFindWithinDistanceFromPointBlock,
      getSpatialToolsCategory
    ); // 26Aug2024

    /*  // 08Jun2025 
     createBlock1(
      "spatial_andor_block",
      SpatialAndOrBlock,
      getSpatialToolsCategory
    ); // 06Sep2024 */

    createBlock1(
      "spatial_orderbynumber_block",
      SpatialOrderByNumberBlock,
      getSpatialToolsCategory
    ); // 11Dec2024
  }

  // 14Feb2025
  function updateDataVizBlocks() {
    createBlock1(
      "viz_map_categories_value_block",
      VizMapCategoriesValueBlock,
      getDataVizToolsCategory
    ); // 14Feb2025
  }

  // 21Aug2024
  function updateBlocks() {
    updateLogicBlocks();
    updateAggregationBlocks();
    updateSpatialBlocks();
    updateDataVizBlocks();
  }

  // 02Feb2025
  async function createRemoteFileDataset(config) {
    const remoteDataset = initializeRemoteDataset(config);
    remoteDataset.ID = mHelperUtil.generateShortGUID();
    remoteDataset.TableName = `tbl_${remoteDataset.ID}`; // 11Feb2025

    // 13Feb2025 await createDatasetData(remoteDataset); // 11Feb2025

    if (hasGeometryColumn(config.DatasetInfo.ColumnsList)) {
      await enhanceDatasetWithGeometry(remoteDataset, config);
    }

    await createDatasetData(remoteDataset); // 13Feb2025
    setDataTypeIcon(remoteDataset, config.DatasetInfo.DataType);

    mDatasetList.push(remoteDataset);
    addDatasetToPanel(remoteDataset);
    updateBlocks();

    return remoteDataset;
  }

  function initializeRemoteDataset(config) {
    return {
      // 11Feb2025 ID: mHelperUtil.generateShortGUID(),
      Name: config.DatasetName,
      // 11Feb2025 TableName: config.DatasetName.replace(" ", "_"),
      Url: config.DatasetUrl,
      Origin: mDatasetOriginTypes.Remote,
      UrlType: config.DatasetInfo.UrlType,
      Description: config.Description,
      ColumnsList: config.DatasetInfo.ColumnsList,
      SelColumnsList: config.DatasetInfo.ColumnsList,
      RecordCount: config.DatasetInfo.RecordCount,
      DatasetType: config.DatasetInfo.DataType,
      ShowPointIcon: false,
      ShowPolygonIcon: false,
      ShowLineIcon: false,
      ShowJSONIcon: false,
      ShowCSVIcon: false,
      ShowParquetIcon: false,
      HasGeometry: false,
      GeometryType: "N/A",
      CRS: "N/A",
    };
  }

  async function enhanceDatasetWithGeometry(dataset, config) {
    dataset.HasGeometry = true;
    dataset.GeomColName = getGeomColName(config.DatasetInfo.ColumnsList);
    dataset.CRS = config.DatasetCRS || "EPSG:4326";

    let datasetLocation;
    if (dataset.Origin === mDatasetOriginTypes.Remote) {
      datasetLocation = config.DatasetUrl;
    }

    if (dataset.Origin === mDatasetOriginTypes.Local) {
      datasetLocation = config.File.name;
    }

    const geomType = await getGeomTypeFromUrl(
      datasetLocation,
      config.DatasetInfo.DataType,
      dataset.GeomColName
    );

    setGeometryTypeIcon(dataset, geomType);
    dataset.GeometryType = geomType;
  }

  function setGeometryTypeIcon(dataset, geomType) {
    const geomTypeIcon = {
      [mGeometryTypes.Point]: "ShowPointIcon",
      [mGeometryTypes.MultiPoint]: "ShowPointIcon",
      [mGeometryTypes.Polygon]: "ShowPolygonIcon",
      [mGeometryTypes.Multipolygon]: "ShowPolygonIcon",
      [mGeometryTypes.Line]: "ShowLineIcon",
      [mGeometryTypes.MultiLine]: "ShowLineIcon",
    };

    if (geomType !== mGeometryTypes.Unknown) {
      const iconProperty = geomTypeIcon[geomType];
      if (iconProperty) {
        dataset[iconProperty] = true;
      }
    }
  }

  function setDataTypeIcon(dataset, dataType) {
    const iconTypes = {
      JSON: "ShowJSONIcon",
      CSV: "ShowCSVIcon",
      PARQUET: "ShowParquetIcon",
      BLOCK: "ShowBlockIcon", // 08Feb2025
    };

    const upperDataType = dataType.toUpperCase();
    if (upperDataType in iconTypes) {
      dataset[iconTypes[upperDataType]] = true;
    }
  }

  // 02Feb2025
  async function createRemoteWebApiDataset(config) {
    // ? load the data in duckdb
    const tempName = "jsondata.json";
    await mDB.registerFileText(
      tempName,
      JSON.stringify(config.DatasetInfo.Data)
    );

    // 11Feb2025
    const datasetID = mHelperUtil.generateShortGUID();
    const tableName = `tbl_${datasetID}`; // 11Feb2025

    // Step 3: Create a table in DuckDB
    const queryStr = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${tempName}';`;
    await mDBConn.query(queryStr);

    // ? Get column names using DuckDB's PRAGMA table_info
    const schema = await mDBConn.query(`PRAGMA table_info('${tableName}')`);
    const schemaDataArr = schema.toArray().map(Object.fromEntries);
    const columnsList = schemaDataArr.map(function (d, i) {
      return {
        ColumnID: i + 1,
        ColumnName: d.name,
        ColumnType: d.type,
      };
    });

    // ? Get record count
    const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
    const countResult = await mDBConn.query(countQuery);
    const recordCount = countResult.toArray()[0].count;

    config.DatasetInfo.ColumnsList = columnsList;
    config.DatasetInfo.RecordCount = recordCount;

    // 13Feb2025 console.log("Columns in the JSON data:", columnsList);
    const remoteDataset = initializeRemoteDataset(config);
    remoteDataset.ID = datasetID;
    remoteDataset.TableName = tableName; // 11Feb2025

    if (hasGeometryColumn(config.DatasetInfo.ColumnsList)) {
      await enhanceDatasetWithGeometry(remoteDataset, config);
    }

    await createDatasetData(remoteDataset); // 13Feb2025

    setDataTypeIcon(remoteDataset, config.DatasetInfo.DataType);

    mDatasetList.push(remoteDataset);
    addDatasetToPanel(remoteDataset);
    updateBlocks();

    // After you're done with the temporary data
    await mDB.dropFile(tempName);

    return remoteDataset;
  }

  async function handleSaveRemoteDatasetClickEvent() {
    displayLoadingIcon("divAddRemoteDatasetLoadingIcon");
    const datasetName = $("#remoteDatasetName").val();
    const datasetURL = $("#remoteDatasetURL").val();
    const datasetCRS = "EPSG:" + $("#remoteDatasetCRS").val(); // 26Jul2024
    const datasetDescription = $("#remoteDatasetDescription").val(); // 11Jun2024

    // 07Jan2025
    const datasetInfo = await getRemoteDatasetInfo(datasetURL); // 18Dec2024

    // ? override manual crs input with crs from metadata query
    const crs = datasetInfo.CRS ? datasetInfo.CRS : datasetCRS;
    if (!crs) {
      hideLoadingIcon("divAddRemoteDatasetLoadingIcon");
      displayAlert(
        `Map Projection not found. Please enter a valid CRS. (e.g., EPSG:4326, EPSG:3857, etc.)`
      );
      throw new Error(
        `Map Projection not found. Please enter a valid CRS. (e.g., EPSG:4326, EPSG:3857, etc.)`
      );
    }

    const config = {
      DatasetName: datasetName,
      DatasetUrl: datasetURL,
      DatasetCRS: crs, // 15Feb2025
      Description: datasetDescription || "N/A",
      DatasetInfo: datasetInfo,
    };

    if (datasetInfo.UrlType === mUrlTypes.File) {
      await createRemoteFileDataset(config);
    } else if (datasetInfo.UrlType === mUrlTypes.WebApi) {
      await createRemoteWebApiDataset(config);
    }

    // 15Jun2025
    $("#divRemoteDatasetSuccessAlert").removeClass("d-none");
    // hide the alert after a few seconds
    setTimeout(() => {
      $("#divRemoteDatasetSuccessAlert").addClass("d-none");
    }, 5000); // Hide after 5 seconds

    // ? clear the input fields
    $("#remoteDatasetName").val("");
    $("#remoteDatasetCRS").val(""); // 26Jul2024
    $("#remoteDatasetURL").val("");
    $("#remoteDatasetDescription").val(""); // 21Jun2024
    hideLoadingIcon("divAddRemoteDatasetLoadingIcon"); // 12Feb2025

    /*  // 14Jun2025
    // const myModalEl = document.getElementById("divRemoteDatasetPanel");
    const modal = bootstrap.Modal.getInstance(myModalEl); //
    modal.hide(); */
  }

  // 14Jun2025
  function getLocalFileDataType(file) {
    // Step 1: Check for file extensions
    const fileExtensions = ["parquet", "csv", "json", "geojson", "xml"];
    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (!fileExtensions.includes(fileExtension)) {
      displayAlert(
        "Invalid file format. Please select a file with a valid extension (e.g.,.parquet,.csv,.json,.geojson,.xml)."
      );
      hideLoadingIcon("divAddLocalDatasetLoadingIcon");
      return;
    }
    // Step 2: Return DataType object with the appropriate DataType based on the file extension
    const dataType = {
      JSON: "JSON",
      CSV: "CSV",
      PARQUET: "PARQUET",
      GEOJSON: "GeoJSON",
      XML: "XML",
    }[fileExtension.toUpperCase()];

    return {
      DataType: dataType,
    };
  }

  // 14Jun2025
  async function getCRSFromLocalFile(file, dataType) {
    let crs;
    let crsDef;
    if (dataType.toUpperCase() === "PARQUET") {
      crsDef = await getCRSFromParquet(file.name);
    }
    return crsDef;
  }

  // 14Jun2025
  async function getColumnsListFromLocalFile(file, dataType) {
    let columnsList;
    if (dataType.toUpperCase() === "PARQUET") {
      // ? This works -  schemaQuery = "DESCRIBE TABLE '" + datasetURL + "';";
      columnsList = await getColumnsListFromParquet(file.name);
    }
    if (dataType.toUpperCase() === "CSV") {
      // ? This works -  schemaQuery = `SELECT * FROM read_csv_auto('${datasetURL}') LIMIT 0;`;
      // schemaQuery = `SELECT * FROM sniff_csv('${datasetURL}')`;
      columnsList = await getColumnsListFromCSV(file.name);
    }
    if (dataType.toUpperCase() === "JSON") {
      columnsList = await getColumnsListFromJSON(file.name); // 19Dec2024
    }

    if (dataType.toUpperCase() === "GEOJSON") {
      columnsList = await getColumnsListFromGeoJson(file.name); // 02Feb2025
    }

    return columnsList;
  }

  // 14Jun2025
  async function getRecordCountFromLocalFile(file, dataType) {
    let countQuery;

    if (dataType.toUpperCase() === "PARQUET") {
      countQuery =
        "SELECT COUNT(*) AS count FROM read_parquet('" + file.name + "')";
    }

    if (dataType.toUpperCase() === "CSV") {
      countQuery =
        "SELECT COUNT(*) AS count FROM read_csv_auto('" + file.name + "')";
    }

    if (dataType.toUpperCase() === "JSON") {
      countQuery =
        "SELECT COUNT(*) AS count FROM read_json_auto('" + file.name + "')";
    }

    if (dataType.toUpperCase() === "GEOJSON") {
      countQuery = "SELECT COUNT(*) AS count FROM ST_Read('" + file.name + "')";
    }

    const countResult = await mDBConn.query(countQuery);
    const count = countResult.toArray()[0].count;
    return count;
  }

  // 14Jun2025
  async function getLocalDatasetInfo(file) {
    let datasetInfo;

    const dataTypeInfo = getLocalFileDataType(file);
    const crs = await getCRSFromLocalFile(file, dataTypeInfo.DataType);
    const columnsList = await getColumnsListFromLocalFile(
      file,
      dataTypeInfo.DataType
    );
    const recordCount = await getRecordCountFromLocalFile(
      file,
      dataTypeInfo.DataType
    );

    datasetInfo = {
      DataType: dataTypeInfo.DataType,
      ColumnsList: columnsList,
      RecordCount: recordCount,
      CRS: crs,
    };

    return datasetInfo;
  }

  // 15Jun2025
  function initializeLocalFileDataset(config) {
    return {
      Name: config.DatasetName,
      Origin: mDatasetOriginTypes.Local,
      Description: config.Description,
      File: config.File,
      ColumnsList: config.DatasetInfo.ColumnsList,
      SelColumnsList: config.DatasetInfo.ColumnsList,
      RecordCount: config.DatasetInfo.RecordCount,
      DatasetType: config.DatasetInfo.DataType,
      ShowPointIcon: false,
      ShowPolygonIcon: false,
      ShowLineIcon: false,
      ShowJSONIcon: false,
      ShowCSVIcon: false,
      ShowParquetIcon: false,
      HasGeometry: false,
      GeometryType: "N/A",
      CRS: "N/A",
    };
  }

  // 15Jun2025
  async function createLocalFileDataset(config) {
    const localFileDataset = initializeLocalFileDataset(config);
    localFileDataset.ID = mHelperUtil.generateShortGUID();
    localFileDataset.TableName = `tbl_${localFileDataset.ID}`; // 11Feb2025

    // 13Feb2025 await createDatasetData(remoteDataset); // 11Feb2025

    if (hasGeometryColumn(config.DatasetInfo.ColumnsList)) {
      await enhanceDatasetWithGeometry(localFileDataset, config);
    }

    await createDatasetData(localFileDataset); // 13Feb2025
    setDataTypeIcon(localFileDataset, config.DatasetInfo.DataType);

    mDatasetList.push(localFileDataset);
    addDatasetToPanel(localFileDataset);
    updateBlocks();

    return localFileDataset;
  }

  // 14Jun2025
  async function handleSaveLocalDatasetClickEvent() {
    displayLoadingIcon("divAddLocalDatasetLoadingIcon");
    const datasetName = $("#localDatasetName").val();
    const file = $("#localDatasetFile").prop("files")[0];
    const filePath = URL.createObjectURL(file);
    const datasetCRS = "EPSG:" + $("#localDatasetCRS").val();
    const datasetDescription = $("#localDatasetDescription").val();

    if (!file) {
      displayAlert("Please select a file.");
      hideLoadingIcon("divAddLocalDatasetLoadingIcon");
      return;
    }

    if (!datasetName) {
      datasetName = file.name.split(".").slice(0, -1).join(".") || file.name;
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Register file in DuckDB's virtual filesystem
    await mDB.registerFileBuffer(file.name, new Uint8Array(buffer));

    try {
      const datasetInfo = await getLocalDatasetInfo(file);
      const crs = datasetInfo.CRS ? datasetInfo.CRS : datasetCRS; // 14Jun2025
      const config = {
        DatasetName: datasetName,
        File: file,
        DatasetCRS: crs,
        Description: datasetDescription || "N/A",
        DatasetInfo: datasetInfo,
      };
      await createLocalFileDataset(config);

      // 15Jun2025
      $("#divLocalDatasetSuccessAlert").removeClass("d-none");
      // hide the alert after a few seconds
      setTimeout(() => {
        $("#divLocalDatasetSuccessAlert").addClass("d-none");
      }, 5000); // Hide after 5 seconds

      // Clear form fields
      $("#localDatasetFile").val("");
      $("#localDatasetName").val("");
      $("#localDatasetCRS").val("");
      $("#localDatasetDescription").val("");

      /*  const modalEl = document.getElementById("divAddDatasetNewModal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide(); */
    } catch (error) {
      console.error("Error saving local dataset:", error);
      displayAlert(`Error saving local dataset: ${error.message}`);
    } finally {
      hideLoadingIcon("divAddLocalDatasetLoadingIcon");
    }
  }

  function populateQueryDDL() {
    const config = {
      QueryList: mQueryList,
    };
    const selectQueryCompiledTemplateHTML = Handlebars.compile(
      SelectQueryTemplateHTML
    );
    const selectQueryGeneratedHTML = selectQueryCompiledTemplateHTML(config);
    $("#queryDDL").empty();
    $("#queryDDL").append(selectQueryGeneratedHTML);
  }

  // 15Jun2025
  function registerHandlebarsEventMethods() {
    // Handlebars helper to join keywords array into a space-separated string
    Handlebars.registerHelper("joinKeywords", function (keywordsArray) {
      if (Array.isArray(keywordsArray) && keywordsArray.length > 0) {
        return keywordsArray.map((k) => String(k).toLowerCase()).join(" "); // Join with space, all lowercase
      }
      return "";
    });
  }

  // 22Aug2024
  function addEventListeners() {
    $.each(mClickEventHandlers, function (k, v) {
      $(document).on("click", k, v);
    });

    // 30Aug2024
    document
      .querySelector(".panel-header")
      .addEventListener("click", function () {
        const content = document.querySelector(".panel-content");
        if (content.style.display === "none") {
          $(".panel-header>span").text("Click to collapse");
          $(".panel-header>i")
            .removeClass("bi-arrows-expand")
            .addClass("bi-arrows-collapse");
        } else {
          $(".panel-header>span").text("Click to expand");
          $(".panel-header>i")
            .removeClass("bi-arrows-collapse")
            .addClass("bi-arrows-expand");
        }
      });

    // 31Aug2024
    $("#divDatasetPreviewPanel").on("shown.bs.modal", function () {
      mPreviewMap.updateSize();
    });

    // 15Jun2025
    // Add event listener for data catalog search input
    $(document).on("input", "#dataCatalogSearchInput", handleDataCatalogSearch);
  }

  async function initDuckDB() {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      })
    );
    // Instantiate the asynchronus version of DuckDB-Wasm
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    mDB = new duckdb.AsyncDuckDB(logger, worker);
    await mDB.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    console.log(await mDB.getVersion());

    mDBConn = await mDB.connect();
    await mDBConn.query(
      "SET custom_extension_repository = 'https://extensions.duckdb.org' "
    );
    await mDBConn.query("SET temp_directory='/path/to/tmp.tmp'"); // 26Aug2024
    await mDBConn.query(
      "INSTALL spatial; LOAD spatial; INSTALL json; LOAD json;"
    ); // ? Use lower case extension names e.g. "spatial", "parquet"  // 03Feb2024
  }

  // 01May2024
  async function initBlocklyWorkspace() {
    // ? Create toolbox with categories
    mBlocklyToolboxContents = {
      kind: "categoryToolbox",
      contents: [
        {
          kind: "category",
          name: "Logic",
          colour: "200",
          toolboxitemid: "1",
          contents: [],
        },
        {
          kind: "category",
          name: "Aggregation",
          colour: "50",
          toolboxitemid: "2",
          contents: [],
        },
        {
          kind: "category",
          name: "Spatial",
          colour: "150",
          toolboxitemid: "3",
          contents: [],
        },
        {
          kind: "category",
          name: "DataViz",
          colour: "250",
          toolboxitemid: "4",
          contents: [],
        },
      ],
    };

    mBlocklyWorkspace = Blockly.inject(mMainBlocklyWorkspaceElemID, {
      toolbox: mBlocklyToolboxContents,
      media: "https://blockly-demo.appspot.com/static/media/",
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
    });
  }

  // 20Aug2024
  function createBlock(blockName, blockClass, categoryGetter) {
    const doesBlockExist = checkIfBlockExists(blockName);
    let blockConfig;
    if (!doesBlockExist) {
      blockConfig = {
        DatasetList: mDatasetList,
        ToolsCategory: categoryGetter(),
      };
      const newBlock = new blockClass();
      newBlock.init(blockConfig);
    } else {
      blockConfig = { DatasetList: mDatasetList };
      const existingBlock = new blockClass();
      existingBlock.update(blockConfig);
    }
    mBlocklyWorkspace.updateToolbox(mBlocklyToolboxContents);
  }

  // 15Sep2024
  function createBlock1(blockName, blockClass, categoryGetter) {
    const blockCustomID = getBlockCustomIDIfBlockExists(blockName); // 27Sep2024
    removeBlockIfBlockExistsinToolsCategory(blockName);

    // ? recreates block in tools category but adds it to the bottom of the tools category: TODO: fix this, 15Sep2024
    const blockConfig = {
      CustomID: blockCustomID,
      DatasetList: mDatasetList,
      Database: mDB, // 14Feb2025
      DatabaseConnection: mDBConn, // 14Feb2025
      ToolsCategory: categoryGetter(),
    };
    const newBlock = new blockClass();
    newBlock.init(blockConfig);
    mBlocklyWorkspace.updateToolbox(mBlocklyToolboxContents);

    // ? update blocks in main workspace
    let blocks = mBlocklyWorkspace.getBlocksByType(blockName);
    // Update each instance of your block
    blocks.forEach(function (block) {
      block.updateFieldDropdownList(blockConfig);
    });
  }

  // 21Aug2024
  function loadLogicBlocks() {
    createBlock("logic_find_block", LogicFindBlock, getLogicToolsCategory);
    createBlock("logic_where_block", LogicWhereBlock, getLogicToolsCategory);
    createBlock("logic_isnull_block", LogicIsNullBlock, getLogicToolsCategory);
    createBlock("logic_inlike_block", LogicInLikeBlock, getLogicToolsCategory);
    createBlock(
      "logic_between_block",
      LogicBetweenBlock,
      getLogicToolsCategory
    );
    createBlock("logic_andor_block", LogicAndOrBlock, getLogicToolsCategory);
    createBlock(
      "logic_comparison_block",
      LogicComparisonBlock,
      getLogicToolsCategory
    );
    createBlock(
      "logic_orderby_block",
      LogicOrderByBlock,
      getLogicToolsCategory
    );
  }

  // 21Aug2024
  function loadAggregationBlocks() {
    createBlock(
      "aggregation_find_block",
      AggregationFindBlock,
      getAggregationToolsCategory
    );
    /*  // 08Jun2025
    createBlock(
      "aggregation_where_block",
      AggregationWhereBlock,
      getAggregationToolsCategory
    ); */
    /*  // 08Jun2025
     createBlock(
      "aggregation_comparison_block",
      AggregationComparisonBlock,
      getAggregationToolsCategory
    ); */
    /*   // 08Jun2025
   createBlock(
      "aggregation_andor_block",
      AggregationAndOrBlock,
      getAggregationToolsCategory
    ); */
    /*  // 08Jun2025
    createBlock(
      "aggregation_inlike_block",
      AggregationInLikeBlock,
      getAggregationToolsCategory
    ); */
    /*  // 08Jun2025
     createBlock(
      "aggregation_isnull_block",
      AggregationIsNullBlock,
      getAggregationToolsCategory
    ); */

    /*  // 08Jun2025
    createBlock(
      "aggregation_between_block",
      AggregationBetweenBlock,
      getAggregationToolsCategory
    ); */

    /*  // 08Jun2025
    createBlock(
      "aggregation_orderby_block",
      AggregationOrderByBlock,
      getAggregationToolsCategory
    ); // 23Aug2024 */
  }

  // 06Sep2024
  function loadSpatialBlocks() {
    // ? load blocks that do not reference a DATASET
    createBlock(
      "spatial_comparison_block",
      SpatialComparisonBlock,
      getSpatialToolsCategory
    );
    createBlock(
      "spatial_inlike_block",
      SpatialInLikeBlock,
      getSpatialToolsCategory
    ); // 07Sep2024

    // 08Sep2024
    createBlock(
      "spatial_isnull_block",
      SpatialIsNullBlock,
      getSpatialToolsCategory
    ); // 08Sep2024

    // 08Sep2024
    createBlock(
      "spatial_between_block",
      SpatialBetweenBlock,
      getSpatialToolsCategory
    ); // 08Sep2024
  }

  // 10Aug2024
  function loadBasicBlocks() {
    loadLogicBlocks(); // 21Aug2024
    loadAggregationBlocks(); // 21Aug2024
    loadSpatialBlocks(); // 06Sep2024
  }

  // 17Jun2025
  async function loadDatasourceHTML(htmlFilePath) {
    return new Promise((resolve, reject) => {
      fetch(htmlFilePath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to load template: ${response.status} ${response.statusText} from ${htmlFilePath}`
            );
          }
          return response.text();
        })
        .then((html) => {
          resolve(html);
        })
        .catch((error) => {
          console.error(`Error loading template from ${htmlFilePath}:`, error);
          reject(error); // Reject the promise on error
        });
    });
  }

  async function loadDatasourceJSModule(moduleID) {
    try {
      /*  // Dynamically import the module using its absolute path
      const moduleFactory = await import(modulePath);
      console.log(moduleFactory);

      if (
        moduleFactory.default &&
        typeof moduleFactory.default === "function"
      ) {
        const moduleInstance = moduleFactory.default(); // Call the factory function
        return moduleInstance;
      } */
      let module;

      switch (moduleID) {
        case "898f93f6-22a6-5d32-3be2-8e230ddf4454":
          module = await import(
            "./modules/datacatalog_js/huggingface_foursquare_places.js"
          );

          const moduleInstance = module.default(); // Call the factory function
          return moduleInstance;
      }
    } catch (error) {
      console.error(
        `Error loading or processing JS module from ${moduleID}:`,
        error
      );
      throw new Error(
        `Failed to load or initialize module from ${moduleID}. Original error: ${error.message}`
      );
    }
  }

  // 16Jun2025
  function initializeDynamicModalLoader() {
    const exploreDataModalElement = document.getElementById("exploreDataModal");
    let exploreDataModalInstance;
    const exploreDataModalBody = document.getElementById(
      "exploreDataModalBody"
    );
    const baseDynamicStyleElementId = "dynamic-modal-styles-";

    if (exploreDataModalElement && exploreDataModalBody) {
      exploreDataModalInstance = new bootstrap.Modal(exploreDataModalElement);

      exploreDataModalElement.addEventListener("hidden.bs.modal", () => {
        exploreDataModalBody.innerHTML = ""; // Clear injected content
        const styleId = exploreDataModalBody.dataset.currentStyleId;
        if (styleId) {
          const existingStyle = document.getElementById(styleId);
          if (existingStyle) {
            existingStyle.remove();
          }
          delete exploreDataModalBody.dataset.currentStyleId;
        }
      });
    } else {
      console.error(
        "Dynamic Data Modal or its body element not found in the DOM."
      );
      return;
    }

    document.addEventListener("click", async function (event) {
      const targetButton = event.target.closest(
        // Selector to catch buttons that might have data-modal-data-source-id
        // or data-modal-target-html for triggering a modal.
        ".btn-explore-dataset"
      );

      if (targetButton) {
        event.preventDefault();

        if (!exploreDataModalInstance || !exploreDataModalBody) {
          console.error("Dynamic Data Modal or body not properly initialized.");
          return;
        }

        const datasetName = targetButton.dataset.name || "Selected Content";
        const modalTitlePrefix =
          targetButton.dataset.modalTitlePrefix || "View: ";
        const contentSelector =
          targetButton.dataset.modalContentSelector || "body";

        let sourceIdentifierForStyleAndLog; // Used for style ID and logging (HTML name or path)

        const modalDataSourceId = targetButton.dataset.modalDataSourceId;

        const catalogItem = mDataCatalogItems.find(
          (item) => item.ID === modalDataSourceId
        );

        // htmlContentPromise = getDatasourceHTML(catalogItem.HTMLFile); // HTMLFile is a name
        const htmlFilePath = `datacatalog/html/${catalogItem.HTMLFile}`; // Construct the path for HTML file
        const htmlString = await loadDatasourceHTML(htmlFilePath); // Fetch HTML content from the constructed path

        // Construct the path for JS module using an absolute path from the server root.
        // This assumes your application is served under '/WebGISApp/'.
        // Adjust '/WebGISApp' if your deployment structure is different.
        // const jsModulePath = `./datacatalog/js/${catalogItem.JSModule}`;
        const jsModule = await loadDatasourceJSModule(modalDataSourceId);
        sourceIdentifierForStyleAndLog = catalogItem.HTMLFile; // Use the name for style ID
        // catalogItemUsed = true; // Ensure this variable is declared if used
        console.log(
          `Attempting to load modal from catalog item '${modalDataSourceId}': HTML Name='${catalogItem.HTMLFile}'`
        );

        const modalTitleElement =
          exploreDataModalElement.querySelector(".modal-title");
        if (modalTitleElement) {
          modalTitleElement.textContent = `${modalTitlePrefix}${datasetName}`;
        }

        const dynamicStyleId =
          baseDynamicStyleElementId +
          sourceIdentifierForStyleAndLog.replace(/[^a-zA-Z0-9]/g, "-");
        exploreDataModalBody.dataset.currentStyleId = dynamicStyleId;

        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlString, "text/html");
          const contentElement = doc.querySelector(contentSelector);

          if (!contentElement) {
            throw new Error(
              `Could not find selector "${contentSelector}" in fetched HTML from ${sourceIdentifierForStyleAndLog}.`
            );
          }
          exploreDataModalBody.innerHTML = contentElement.innerHTML;

          const styleTag = doc.head.querySelector("style");

          if (styleTag) {
            let existingStyle = document.getElementById(dynamicStyleId);
            if (!existingStyle) {
              existingStyle = document.createElement("style");
              existingStyle.id = dynamicStyleId;
              document.head.appendChild(existingStyle);
            }
            existingStyle.textContent = styleTag.textContent;
          }

          const initConfig = {};
          initConfig.DuckDbInstance = mDB;
          jsModule.init(initConfig);

          exploreDataModalInstance.show();
        } catch (error) {
          console.error(
            `Error loading or initializing dynamic modal content from ${sourceIdentifierForStyleAndLog} (JS: ${jsModulePath}):`,
            error
          );
          exploreDataModalBody.innerHTML = `<div class="alert alert-danger" role="alert">Error loading content: ${error.message}</div>`;
          exploreDataModalInstance.show();
        }
      }
    });
  }

  function loadCSS() {
    // ? 23Jan2022 The bootstrap-icons css file needs to be loaded through a CDN and is specified in the <head> of DiabetesAtlas.html.
    // ? Downloading the physical css file and loading through code does not work. A font required by bootstrap-icons is not being found after the file is loaded.
    const cssFileNames = [
      "ol.css",
      "bootstrap.min.css",
      "datatables.min.css",
      "webgis.css",
    ];
    mHelperUtil.loadCSSFiles(cssFileNames);
  }

  publicAPI.init = async function () {
    mHelperUtil = new HelperUtil();
    Blockly.setLocale(En);
    mMediator = Mediator();
    loadCSS();
    populateQueryDDL();
    await initDuckDB();
    initializeDynamicModalLoader(); // 16Jun2025
    addEventListeners();
    registerHandlebarsEventMethods(); // 15Jun2025
    await initBlocklyWorkspace();
    loadBasicBlocks(); // 10Aug2024
    createResultsMap();
    const panelContent = document.querySelector(".panel-content");
    panelContent.style.display = "block"; // 22Aug2024
  };

  return publicAPI;
}
export default WebGIS;
