import { MimeTypes } from "sf-html-extension/constants";

import { IApplication } from "sf-core/application";

// components
import { dependency as cssPaneComponentDependency } from "./components/css-pane";
import { dependency as entityPreviewComponentDependency } from "./components/entity-preview";
import { dependency as artboardToolComponentDependency } from "./components/artboard-tool";

// layer components
import { dependency as textLayerLabelComponentDependency } from "./components/text-layer-label";
import { dependency as elementLayerLabelComponentDependency } from "./components/element-layer-label";
import { dependency as commentLayerLabelComponentDependency } from "./components/comment-layer-label";

// models
import { cssFileDependency } from "./models/css-file";
import { htmlFileModelDependency } from "./models/html-file";
import { htmlDisplayEntitySelectionDependency } from "./models/display-selection";

// services
import { dependency as pasteEntityService } from "./services/paste-entity";
import { dependency as selectWithCssSelectorService } from "./services/select-with-css-selector";

 // tools
import { dependency as textToolDependency, editInnerHTMLDependency } from "./models/text-tool";

// key bindings
import { dependencies as keyBindingDependencies } from "./key-bindings";

import { MimeTypeDependency } from "sf-core/dependencies";

 // entities
 import {
   htmlTextDependency,
   linkEntityDependency,
   htmlCommentDependency,
   htmlArtboardDependency,
   htmlElementDependencies,
   htmlStyleEntityDependency,
   htmlDocumentFragmentDependency,
} from "./ast";

export const dependency = [

  // components
  cssPaneComponentDependency,
  artboardToolComponentDependency,
  entityPreviewComponentDependency,
  textLayerLabelComponentDependency,
  commentLayerLabelComponentDependency,
  elementLayerLabelComponentDependency,

  // services
  pasteEntityService,
  selectWithCssSelectorService,

  // models
  cssFileDependency,
  htmlFileModelDependency,
  htmlDisplayEntitySelectionDependency,

  // tools
  textToolDependency,
  editInnerHTMLDependency,

  // key bindings
  ...keyBindingDependencies,

  // entities
  htmlTextDependency,
  linkEntityDependency,
  htmlCommentDependency,
  htmlStyleEntityDependency,
  ...htmlElementDependencies,
  htmlArtboardDependency,
  htmlDocumentFragmentDependency,

  // mime types
  new MimeTypeDependency("htm", MimeTypes.HTML_MIME_TYPE),
  new MimeTypeDependency("html", MimeTypes.HTML_MIME_TYPE),
  new MimeTypeDependency("sfn", MimeTypes.HTML_MIME_TYPE)
];
