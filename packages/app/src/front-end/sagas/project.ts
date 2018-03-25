import { fork, put, call, take, select } from "redux-saga/effects";
import { projectDirectoryLoaded, PROJECT_DIRECTORY_LOADED, FILE_NAVIGATOR_ITEM_CLICKED, fileNavigatorItemClicked, dependencyEntryLoaded } from "front-end/actions";
import { PAPERCLIP_EXTENSION_NAME, loadEntry } from "paperclip";
import { File, Directory, xmlToTreeNode, getFilesWithExtension, getFilePath, getTeeNodePath, getTreeNodeFromPath, getFilePathFromNodePath } from "common";
import { RootState, getActiveWindow } from "../state";

export function* projectSaga() {
  yield fork(handleActiveFile);
  yield fork(handleProjectDirectoryLoaded);
  yield fork(putFakeDirectory);
}

function* putFakeDirectory() {
  const rootDirectory = xmlToTreeNode(`
    <directory name="components">
      <file name="main.pc">
      </file>
    </directory>
  `) as Directory;
  
  yield put(projectDirectoryLoaded(rootDirectory));
}

function* handleProjectDirectoryLoaded() {
  while(1) {
    yield take(PROJECT_DIRECTORY_LOADED);
    const { projectDirectory }: RootState = yield select();
    const [mainPaperclipFile] = getFilesWithExtension(PAPERCLIP_EXTENSION_NAME, projectDirectory);
    yield put(fileNavigatorItemClicked(getTeeNodePath(mainPaperclipFile, projectDirectory)));
  }
}

const TEST_FILES = {
  "components/main.pc": `
    <module>
      <component id="test" style="background-color: red; color: white; padding: 20px; border-radius: 10px;">
        <template>
          <text value="hello" />
        </template>
      </component>
    </module>
  `
}


function* handleActiveFile() {
  while(1) {
    const { path } = yield take(FILE_NAVIGATOR_ITEM_CLICKED);    
    const state: RootState = yield select();
    const { entry, graph } = yield call(loadEntry, state.activeFilePath, {
      graph: state.browser.graph,
      openFile: filePath => TEST_FILES[filePath]
    });
    yield put(dependencyEntryLoaded(entry, graph));
  }
}