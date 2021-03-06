import {
  arraySplice,
  Directory,
  memoize,
  EMPTY_ARRAY,
  StructReference,
  Point,
  Translate,
  Bounds,
  pointIntersectsBounds,
  getSmallestBounds,
  mergeBounds,
  Bounded,
  Struct,
  getTreeNodeIdMap,
  getNestedTreeNodeById,
  boundsFromRect,
  getFileFromUri,
  File,
  updateNestedNode,
  FileAttributeNames,
  isDirectory,
  getParentTreeNode,
  TreeNode,
  getBoundsSize,
  centerTransformZoom,
  createZeroBounds,
  getTreeNodeHeight,
  flattenTreeNode,
  shiftBounds,
  shiftPoint,
  flipPoint,
  moveBounds,
  FSItem,
  FSItemNamespaces,
  getTreeNodePath,
  updateNestedNodeTrail,
  getTreeNodeFromPath
} from "tandem-common";
import {
  SyntheticVisibleNode,
  PCEditorState,
  getSyntheticDocumentByDependencyUri,
  getSyntheticSourceNode,
  getPCNodeDependency,
  findRootInstanceOfPCNode,
  getSyntheticNodeById,
  getSyntheticVisibleNodeDocument,
  updateSyntheticVisibleNode,
  Frame,
  getSyntheticDocumentDependencyUri,
  getSyntheticVisibleNodeRelativeBounds,
  updateDependencyGraph,
  updateSyntheticVisibleNodeMetadata,
  queueLoadDependencyUri,
  isSyntheticVisibleNodeMovable,
  isSyntheticVisibleNodeResizable,
  updateFrame,
  diffSyntheticNode,
  SyntheticOperationalTransformType,
  SyntheticInsertChildOperationalTransform,
  PCSourceTagNames,
  patchSyntheticNode,
  getSyntheticDocumentById,
  SyntheticDocument,
  updateSyntheticDocument,
  getFrameByContentNodeId,
  getFramesByDependencyUri
} from "paperclip";
import {
  CanvasToolOverlayMouseMoved,
  CanvasToolOverlayClicked
} from "../actions";
import { uniq, pull, values } from "lodash";
import { stat } from "fs";
import {
  replaceDependency,
  PCDependency,
  Dependency,
  DependencyGraph,
  getModifiedDependencies
} from "paperclip";

export enum ToolType {
  TEXT,
  ELEMENT,
  ARTBOARD
}

export const REGISTERED_COMPONENT = "REGISTERED_COMPONENT";

export enum SyntheticVisibleNodeMetadataKeys {
  EDITING_LABEL = "editingLabel",
  EXPANDED = "expanded"
}

export type RegisteredComponent = {
  uri?: string;
  tagName: string;
  template: TreeNode<any>;
};

export type Canvas = {
  backgroundColor: string;
  mousePosition?: Point;
  movingOrResizing?: boolean;
  container?: HTMLElement;
  panning?: boolean;
  translate: Translate;
  secondarySelection?: boolean;
  fullScreen?: boolean;
  smooth?: boolean;
};

export enum InsertFileType {
  FILE,
  DIRECTORY
}

export type InsertFileInfo = {
  type: InsertFileType;
  directoryId: string;
};

export type DependencyHistory = {
  index: number;
  snapshots: Dependency<any>[];
};

export type GraphHistory = {
  [identifier: string]: DependencyHistory;
};

export type Editor = {
  activeFilePath?: string;
  tabUris: string[];
  canvas: Canvas;
};

export type RootState = {
  editors: Editor[];
  mount: Element;
  openFiles: OpenFile[];
  toolType?: ToolType;
  activeEditorFilePath?: string;

  // TODO - should be actual instances for type safety
  hoveringNodeIds: string[];

  // TODO - this should be actual node instances
  selectedNodeIds: string[];
  selectedFileNodeIds: string[];
  selectedComponentVariantName?: string;
  projectDirectory?: Directory;
  insertFileInfo?: InsertFileInfo;
  history: GraphHistory;
  showQuickSearch?: boolean;
} & PCEditorState;

export type OpenFile = {
  temporary: boolean;
  newContent?: Buffer;
  uri: string;
};

export const updateRootState = (
  properties: Partial<RootState>,
  root: RootState
) => ({
  ...root,
  ...properties
});

export const deselectRootProjectFiles = (state: RootState) =>
  updateRootState(
    {
      selectedFileNodeIds: []
    },
    state
  );

export const persistRootState = (
  persistPaperclipState: (state: RootState) => RootState,
  state: RootState
) => {
  const oldState = state;
  const oldGraph = state.graph;
  state = keepActiveFileOpen(
    updateRootState(persistPaperclipState(state), state)
  );
  const modifiedDeps = getModifiedDependencies(state.graph, oldGraph);
  state = addHistory(state, modifiedDeps.map(dep => oldGraph[dep.uri]));
  state = modifiedDeps.reduce(
    (state, dep: Dependency<any>) => setOpenFileContent(dep, state),
    state
  );
  return state;
};

const getUpdatedSyntheticVisibleNodes = (
  newState: RootState,
  oldState: RootState
) => {
  let newSyntheticVisibleNodes: SyntheticVisibleNode[] = [];
  for (const newDocument of newState.documents) {
    const oldDocument = getSyntheticDocumentById(
      newDocument.id,
      oldState.documents
    );
    if (!oldDocument) {
      continue;
    }

    let model: SyntheticDocument = oldDocument;

    diffSyntheticNode(oldDocument, newDocument).forEach(ot => {
      const target = getTreeNodeFromPath(ot.nodePath, model);
      model = patchSyntheticNode([ot], model);

      // TODO - will need to check if new parent is not in an instance of a component.
      // Will also need to consider child overrides though.
      if (ot.type === SyntheticOperationalTransformType.INSERT_CHILD) {
        newSyntheticVisibleNodes.push(ot.child);
      } else if (
        ot.type === SyntheticOperationalTransformType.SET_PROPERTY &&
        ot.name === "source"
      ) {
        newSyntheticVisibleNodes.push(target);
      }
    });
  }

  return uniq(newSyntheticVisibleNodes);
};

export const selectInsertedSyntheticVisibleNodes = (
  oldState: RootState,
  newState: RootState
) => {
  return setSelectedSyntheticVisibleNodeIds(
    newState,
    ...getUpdatedSyntheticVisibleNodes(newState, oldState).map(node => node.id)
  );
};

const setOpenFileContent = (dep: Dependency<any>, state: RootState) =>
  updateOpenFile(
    {
      temporary: false,
      newContent: new Buffer(JSON.stringify(dep.content, null, 2), "utf8")
    },
    dep.uri,
    state
  );

const addHistory = (root: RootState, modifiedDeps: Dependency<any>[]) => {
  return modifiedDeps.reduce((state, dep) => {
    const history: DependencyHistory = state.history[dep.uri] || {
      index: 0,
      snapshots: EMPTY_ARRAY
    };

    const snapshots = [...history.snapshots.slice(0, history.index), dep];

    return updateRootState(
      {
        history: {
          [dep.uri]: {
            index: snapshots.length,
            snapshots
          }
        }
      },
      state
    );
  }, root);
};

const moveDependencyRecordHistory = (
  uri: string,
  pos: number,
  root: RootState
): RootState => {
  const record = root.history[uri];
  if (!record) {
    return root;
  }

  const index = Math.max(
    0,
    Math.min(record.snapshots.length, record.index + pos)
  );

  // if index exceeds snapshot count, then we're at the end.
  const dep = record.snapshots[index] || root.graph[uri];

  root = updateRootState(
    {
      history: {
        [uri]: {
          ...record,
          index
        }
      },
      selectedFileNodeIds: [],
      selectedNodeIds: [],
      hoveringNodeIds: []
    },
    root
  );

  root = setOpenFileContent(dep, root);
  root = replaceDependency(dep, root);
  return root;
};

const DEFAULT_CANVAS: Canvas = {
  backgroundColor: "#EEE",
  translate: {
    left: 0,
    top: 0,
    zoom: 1
  }
};

export const undo = (root: RootState) =>
  root.editors.reduce(
    (state, editor) =>
      moveDependencyRecordHistory(editor.activeFilePath, -1, root),
    root
  );
export const redo = (root: RootState) =>
  root.editors.reduce(
    (state, editor) =>
      moveDependencyRecordHistory(editor.activeFilePath, 1, root),
    root
  );

export const getOpenFile = (uri: string, state: RootState) =>
  state.openFiles.find(openFile => openFile.uri === uri);

export const getOpenFilesWithContent = (state: RootState) =>
  state.openFiles.filter(openFile => openFile.newContent);

export const updateOpenFileContent = (
  uri: string,
  newContent: Buffer,
  state: RootState
) => {
  return updateOpenFile(
    {
      temporary: false,
      newContent
    },
    uri,
    state
  );
};

export const getActiveEditor = (state: RootState) =>
  getEditorWithActiveFileUri(state.activeEditorFilePath, state);

export const updateOpenFile = (
  properties: Partial<OpenFile>,
  uri: string,
  state: RootState
) => {
  const file = getOpenFile(uri, state);

  if (!file) {
    state = addOpenFile(uri, false, state);
    return updateOpenFile(properties, uri, state);
  }

  const index = state.openFiles.indexOf(file);
  return updateRootState(
    {
      openFiles: arraySplice(state.openFiles, index, 1, {
        ...file,
        ...properties
      })
    },
    state
  );
};

export const upsertOpenFile = (
  uri: string,
  temporary: boolean,
  state: RootState
): RootState => {
  const file = getOpenFile(uri, state);
  if (file) {
    if (file.temporary !== temporary) {
      return updateOpenFile({ temporary }, uri, state);
    }
    return state;
  }

  return addOpenFile(uri, temporary, state);
};

export const getEditorWithFileUri = (uri: string, state: RootState): Editor => {
  return state.editors.find(editor => editor.tabUris.indexOf(uri) !== -1);
};

export const getEditorWithActiveFileUri = (
  uri: string,
  state: RootState
): Editor => {
  return state.editors.find(editor => editor.activeFilePath === uri);
};

export const openSecondEditor = (uri: string, state: RootState) => {
  const editor = getEditorWithFileUri(uri, state);
  const i = state.editors.indexOf(editor);
  if (i === 1) {
    return openEditorFileUri(uri, state);
  }

  if (i === 0 && editor.tabUris.length === 1) {
    return state;
  }

  const newTabUris = arraySplice(
    editor.tabUris,
    editor.tabUris.indexOf(uri),
    1
  );

  state = {
    ...state,
    editors: arraySplice(state.editors, i, 1, {
      ...editor,
      tabUris: newTabUris,
      activeFilePath:
        editor.activeFilePath === uri
          ? newTabUris[newTabUris.length - 1]
          : editor.activeFilePath
    })
  };

  if (state.editors.length === 1) {
    state = {
      ...state,
      editors: [
        ...state.editors,

        { tabUris: [], activeFilePath: null, canvas: DEFAULT_CANVAS }
      ]
    };
  }

  const secondEditor = state.editors[1];
  return {
    ...state,
    editors: arraySplice(
      state.editors,
      state.editors.indexOf(secondEditor),
      1,
      {
        ...secondEditor,
        tabUris: [...secondEditor.tabUris, uri],
        activeFilePath: uri
      }
    )
  };
};

export const getSyntheticWindowBounds = memoize(
  (uri: string, state: RootState) => {
    const frames = getFramesByDependencyUri(
      uri,
      state.frames,
      state.documents,
      state.graph
    );
    if (!window) return createZeroBounds();
    return mergeBounds(...(frames || EMPTY_ARRAY).map(frame => frame.bounds));
  }
);

export const openEditorFileUri = (uri: string, state: RootState): RootState => {
  const editor = getEditorWithFileUri(uri, state) || state.editors[0];

  return {
    ...state,
    hoveringNodeIds: [],
    selectedNodeIds: [],
    activeEditorFilePath: uri,
    editors: editor
      ? arraySplice(state.editors, state.editors.indexOf(editor), 1, {
          ...editor,
          tabUris:
            editor.tabUris.indexOf(uri) === -1
              ? [...editor.tabUris, uri]
              : editor.tabUris,
          activeFilePath: uri
        })
      : [
          {
            tabUris: [uri],
            activeFilePath: uri,
            canvas: DEFAULT_CANVAS
          }
        ]
  };
};

export const setNextOpenFile = (state: RootState): RootState => {
  const hasOpenFile = state.openFiles.find(openFile =>
    Boolean(getEditorWithActiveFileUri(openFile.uri, state))
  );
  if (hasOpenFile) {
    return state;
  }
  state = {
    ...state,
    hoveringNodeIds: [],
    selectedNodeIds: []
  };

  if (state.openFiles.length) {
    state = openEditorFileUri(state.openFiles[0].uri, state);
  }

  state = {
    ...state,
    editors: []
  };

  return state;
};

export const removeTemporaryOpenFiles = (state: RootState) => {
  return {
    ...state,
    openFiles: state.openFiles.filter(openFile => !openFile.temporary)
  };
};

export const openSyntheticVisibleNodeOriginFile = (
  node: SyntheticVisibleNode,
  state: RootState
) => {
  const sourceNode = getSyntheticSourceNode(
    node as SyntheticVisibleNode,
    state.graph
  );
  const uri = getPCNodeDependency(sourceNode.id, state.graph).uri;
  state = openEditorFileUri(uri, state);
  const instance = findRootInstanceOfPCNode(sourceNode, state.documents);
  state = setActiveFilePath(uri, state);
  state = setSelectedSyntheticVisibleNodeIds(state, instance.id);
  return state;
};

export const addOpenFile = (
  uri: string,
  temporary: boolean,
  state: RootState
): RootState => {
  const file = getOpenFile(uri, state);
  if (file) {
    return state;
  }

  state = removeTemporaryOpenFiles(state);

  return {
    ...state,
    openFiles: [
      ...state.openFiles,
      {
        uri,
        temporary
      }
    ]
  };
};

// export const getInsertedWindowElementIds = (
//   oldWindow: SyntheticWindow,
//   targetFrameId: string,
//   newBrowser: PCEditorState
// ): string[] => {
//   const elementIds = oldWindow.documents
//     .filter(document => !targetFrameId || document.id === targetFrameId)
//     .reduce((nodeIds, oldFrame) => {
//       return [
//         ...nodeIds,
//         ...getInsertedFrameElementIds(oldFrame, newBrowser)
//       ];
//     }, []);
//   const newWindow = newBrowser.windows.find(
//     window => window.location === oldWindow.location
//   );
//   return [
//     ...elementIds,
//     ...newWindow.documents
//       .filter(document => {
//         const isInserted =
//           oldWindow.documents.find(oldFrame => {
//             return oldFrame.id === document.id;
//           }) == null;
//         return isInserted;
//       })
//       .map(document => document.root.id)
//   ];
// };

// export const getInsertedFrameElementIds = (
//   oldFrame: Frame,
//   newBrowser: PCEditorState
// ): string[] => {
//   const newFrame = getFrameById(oldFrame.id, newBrowser);
//   if (!newFrame) {
//     return [];
//   }
//   const oldIds = Object.keys(oldFrame.nativeNodeMap);
//   const newIds = Object.keys(newFrame.nativeNodeMap);
//   return pull(newIds, ...oldIds);
// };

export const keepActiveFileOpen = (state: RootState): RootState => {
  return {
    ...state,
    openFiles: state.openFiles.map(openFile => ({
      ...openFile,
      temporary: false
    }))
  };
};

// export const updateRootStateSyntheticWindowFrame = (
//   documentId: string,
//   properties: Partial<Frame>,
//   root: RootState
// ) => {
//   const window = getFrameWindow(documentId, root);
//   const document = getFrameById(documentId, root);
//   return updateRootState(
//     {
//       browser: updateSyntheticWindow(
//         window.location,
//         {
//           documents: arraySplice(
//             window.documents,
//             window.documents.indexOf(document),
//             1,
//             {
//               ...document,
//               ...properties
//             }
//           )
//         },
//         root
//       )
//     },
//     root
//   );
// };

export const setRootStateSyntheticVisibleNodeExpanded = (
  nodeId: string,
  value: boolean,
  state: RootState
) => {
  const node = getSyntheticNodeById(nodeId, state.documents);
  const document = getSyntheticVisibleNodeDocument(node.id, state.documents);

  state = updateSyntheticDocument(
    setSyntheticVisibleNodeExpanded(node, value, document),
    document,
    state
  );

  return state;
};

const setSyntheticVisibleNodeExpanded = (
  node: SyntheticVisibleNode,
  value: boolean,
  document: SyntheticDocument
): SyntheticVisibleNode => {
  const path = getTreeNodePath(node.id, document);
  const updater = (node: SyntheticVisibleNode) => {
    return {
      ...node,
      metadata: {
        ...node.metadata,
        [SyntheticVisibleNodeMetadataKeys.EXPANDED]: value
      }
    };
  };
  return (value
    ? updateNestedNodeTrail(path, document, updater)
    : updateNestedNode(node, document, updater)) as SyntheticVisibleNode;
};

export const setRootStateSyntheticVisibleNodeLabelEditing = (
  nodeId: string,
  value: boolean,
  state: RootState
) => {
  const node = getSyntheticNodeById(nodeId, state.documents);
  const document = getSyntheticVisibleNodeDocument(node.id, state.documents);
  state = updateSyntheticDocument(
    updateSyntheticVisibleNodeMetadata(
      {
        [SyntheticVisibleNodeMetadataKeys.EDITING_LABEL]: value
      },
      node,
      document
    ),
    document,
    state
  );
  return state;
};

export const setRootStateFileNodeExpanded = (
  nodeId: string,
  value: boolean,
  state: RootState
) => {
  return updateRootState(
    {
      projectDirectory: updateNestedNode(
        getNestedTreeNodeById(nodeId, state.projectDirectory),
        state.projectDirectory,
        (child: FSItem) => ({
          ...child,
          expanded: value
        })
      )
    },
    state
  );
};

export const openSyntheticPCFile = (
  uri: string,
  state: RootState
): RootState => {
  const graph = state.graph;
  const entry = graph[uri];
  if (!entry) {
    throw new Error(`Cannot open window if graph entry is not loaded`);
  }

  return queueLoadDependencyUri(uri, state);
};

export const updateEditor = (
  properties: Partial<Editor>,
  uri: string,
  root: RootState
) => {
  const editor = getEditorWithFileUri(uri, root);
  const i = root.editors.indexOf(editor);
  return updateRootState(
    {
      editors: arraySplice(root.editors, i, 1, {
        ...editor,
        ...properties
      })
    },
    root
  );
};

const INITIAL_ZOOM_PADDING = 50;

export const centerEditorCanvas = (
  state: RootState,
  editorFileUri: string,
  innerBounds?: Bounds,
  smooth: boolean = false,
  zoomOrZoomToFit: boolean | number = true
) => {
  if (!innerBounds) {
    const frames = getFramesByDependencyUri(
      editorFileUri,
      state.frames,
      state.documents,
      state.graph
    );

    if (!frames.length) {
      return state;
    }

    innerBounds = getSyntheticWindowBounds(editorFileUri, state);
  }

  // no windows loaded
  if (
    innerBounds.left +
      innerBounds.right +
      innerBounds.top +
      innerBounds.bottom ===
    0
  ) {
    console.warn(` Cannot center when bounds has no size`);
    return updateEditorCanvas(
      {
        translate: { left: 0, top: 0, zoom: 1 }
      },
      editorFileUri,
      state
    );
  }

  const editor = getEditorWithFileUri(editorFileUri, state);

  const {
    canvas: { container, translate }
  } = editor;
  if (!container) {
    console.warn("cannot center canvas without a container");
    return state;
  }

  const { width, height } = container.getBoundingClientRect();

  const innerSize = getBoundsSize(innerBounds);

  const centered = {
    left: -innerBounds.left + width / 2 - innerSize.width / 2,
    top: -innerBounds.top + height / 2 - innerSize.height / 2
  };

  const scale =
    typeof zoomOrZoomToFit === "boolean"
      ? Math.min(
          (width - INITIAL_ZOOM_PADDING) / innerSize.width,
          (height - INITIAL_ZOOM_PADDING) / innerSize.height
        )
      : typeof zoomOrZoomToFit === "number"
        ? zoomOrZoomToFit
        : translate.zoom;

  state = updateEditorCanvas(
    {
      smooth,
      translate: centerTransformZoom(
        {
          ...centered,
          zoom: 1
        },
        { left: 0, top: 0, right: width, bottom: height },
        Math.min(scale, 1)
      )
    },
    editorFileUri,
    state
  );

  return state;
};

export const setActiveFilePath = (
  newActiveFilePath: string,
  root: RootState
) => {
  if (getEditorWithActiveFileUri(newActiveFilePath, root)) {
    return root;
  }
  root = openEditorFileUri(newActiveFilePath, root);
  root = addOpenFile(newActiveFilePath, true, root);
  root = centerEditorCanvas(root, newActiveFilePath);
  return root;
};

export const updateEditorCanvas = (
  properties: Partial<Canvas>,
  uri: string,
  root: RootState
) => {
  const editor = getEditorWithFileUri(uri, root);
  return updateEditor(
    {
      canvas: {
        ...editor.canvas,
        ...properties
      }
    },
    uri,
    root
  );
};

export const setInsertFile = (type: InsertFileType, state: RootState) => {
  const file = getNestedTreeNodeById(
    state.selectedFileNodeIds[0] || state.projectDirectory.id,
    state.projectDirectory
  );
  return updateRootState(
    {
      insertFileInfo: {
        type,
        directoryId: isDirectory(file)
          ? file.id
          : getParentTreeNode(file.id, state.projectDirectory).id
      }
    },
    state
  );
};

export const setTool = (toolType: ToolType, root: RootState) => {
  if (!root.editors.length) {
    return root;
  }
  root = updateRootState({ toolType }, root);
  root = setSelectedSyntheticVisibleNodeIds(root);
  return root;
};

export const getActiveFrames = (root: RootState): Frame[] =>
  values(root.frames).filter(frame =>
    root.editors.some(
      editor =>
        editor.activeFilePath ===
        getSyntheticDocumentDependencyUri(
          getSyntheticVisibleNodeDocument(frame.contentNodeId, root.documents),
          root.graph
        )
    )
  );

export const getCanvasTranslate = (canvas: Canvas) => canvas.translate;

export const getScaledMouseCanvasPosition = (
  state: RootState,
  point: Point
) => {
  const canvas = getActiveEditor(state).canvas;
  const translate = getCanvasTranslate(canvas);

  const scaledPageX = (point.left - translate.left) / translate.zoom;
  const scaledPageY = (point.top - translate.top) / translate.zoom;
  return { left: scaledPageX, top: scaledPageY };
};

export const getCanvasMouseTargetNodeId = (
  state: RootState,
  event: CanvasToolOverlayMouseMoved | CanvasToolOverlayClicked,
  filter?: (node: TreeNode<any>) => boolean
): string => {
  return getCanvasMouseTargetNodeIdFromPoint(
    state,
    {
      left: event.sourceEvent.pageX,
      top: event.sourceEvent.pageY
    },
    filter
  );
};

export const getCanvasMouseTargetNodeIdFromPoint = (
  state: RootState,
  point: Point,
  filter?: (node: TreeNode<any>) => boolean
): string => {
  const editor = getActiveEditor(state);
  const canvas = editor.canvas;
  const translate = getCanvasTranslate(canvas);
  const toolType = state.toolType;

  const scaledMousePos = getScaledMouseCanvasPosition(state, point);

  const frame = getFrameFromPoint(scaledMousePos, state);

  if (!frame) return null;
  const contentNode = getSyntheticNodeById(
    frame.contentNodeId,
    state.documents
  );

  const { left: scaledPageX, top: scaledPageY } = scaledMousePos;

  const deadZone = getSelectionBounds(state);

  const mouseX = scaledPageX - frame.bounds.left;
  const mouseY = scaledPageY - frame.bounds.top;

  const computedInfo = frame.computed || {};
  const intersectingBounds: Bounds[] = [];
  const intersectingBoundsMap = new Map<Bounds, string>();
  const mouseFramePoint = { left: mouseX, top: mouseY };
  for (const $id in computedInfo) {
    const { bounds } = computedInfo[$id];
    if (
      pointIntersectsBounds(mouseFramePoint, bounds) &&
      !pointIntersectsBounds(scaledMousePos, deadZone) &&
      (toolType == null ||
        getNestedTreeNodeById($id, contentNode).name !==
          PCSourceTagNames.TEXT) &&
      (!filter || filter(getNestedTreeNodeById($id, contentNode)))
    ) {
      intersectingBounds.push(bounds);
      intersectingBoundsMap.set(bounds, $id);
    }
  }

  if (!intersectingBounds.length) return null;
  const smallestBounds = getSmallestBounds(...intersectingBounds);
  return intersectingBoundsMap.get(smallestBounds);
};

export const getCanvasMouseFrame = (
  state: RootState,
  event: CanvasToolOverlayMouseMoved | CanvasToolOverlayClicked
) => {
  return getFrameFromPoint(
    getScaledMouseCanvasPosition(state, {
      left: event.sourceEvent.pageX,
      top: event.sourceEvent.pageY
    }),
    state
  );
};

export const getFrameFromPoint = (point: Point, state: RootState) => {
  const activeFrames = getActiveFrames(state);
  if (!activeFrames.length) return null;
  for (let j = activeFrames.length; j--; ) {
    const frame = activeFrames[j];
    if (pointIntersectsBounds(point, frame.bounds)) {
      return frame;
    }
  }
};

export const setSelectedSyntheticVisibleNodeIds = (
  root: RootState,
  ...selectionIds: string[]
) => {
  const nodeIds = uniq([...selectionIds]).filter(Boolean);
  root = nodeIds.reduce(
    (state, nodeId) =>
      setRootStateSyntheticVisibleNodeExpanded(nodeId, true, root),
    root
  );
  root = updateRootState(
    {
      selectedNodeIds: nodeIds
    },
    root
  );
  return root;
};

export const setSelectedFileNodeIds = (
  root: RootState,
  ...selectionIds: string[]
) => {
  const nodeIds = uniq([...selectionIds]);
  root = nodeIds.reduce(
    (state, nodeId) => setRootStateFileNodeExpanded(nodeId, true, root),
    root
  );

  root = updateRootState(
    {
      selectedFileNodeIds: nodeIds
    },
    root
  );
  return root;
};

export const setHoveringSyntheticVisibleNodeIds = (
  root: RootState,
  ...selectionIds: string[]
) => {
  return updateRootState(
    {
      hoveringNodeIds: uniq([...selectionIds])
    },
    root
  );
};

// export const updateRootSyntheticPosition = (
//   position: Point,
//   nodeId: string,
//   root: RootState
// ) =>
//   updateRootState(
//     {
//       browser: updateSyntheticItemPosition(position, nodeId, root)
//     },
//     root
//   );

// export const updateRootSyntheticBounds = (
//   bounds: Bounds,
//   nodeId: string,
//   root: RootState
// ) =>
//   updateRootState(
//     {
//       browser: updateSyntheticItemBounds(bounds, nodeId, root)
//     },
//     root
//   );

export const getBoundedSelection = memoize((root: RootState): string[] =>
  root.selectedNodeIds.filter(nodeId =>
    getSyntheticVisibleNodeRelativeBounds(
      getSyntheticNodeById(nodeId, root.documents),
      root.frames
    )
  )
);

export const getSelectionBounds = memoize((root: RootState) =>
  mergeBounds(
    ...getBoundedSelection(root).map(nodeId =>
      getSyntheticVisibleNodeRelativeBounds(
        getSyntheticNodeById(nodeId, root.documents),
        root.frames
      )
    )
  )
);

export const isSelectionMovable = memoize((root: RootState) => {
  return !root.selectedNodeIds.some(nodeId => {
    const node = getSyntheticNodeById(nodeId, root.documents);
    return !isSyntheticVisibleNodeMovable(node);
  });
});

export const isSelectionResizable = memoize((root: RootState) => {
  return !root.selectedNodeIds.some(nodeId => {
    const node = getSyntheticNodeById(nodeId, root.documents);
    return !isSyntheticVisibleNodeResizable(node);
  });
});
