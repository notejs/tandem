
import { MetadataKeys } from "tandem-front-end/constants";
import { FrontEndApplication } from "tandem-front-end/application";
import {
  IEntity,
  loggable,
  bindable,
  BaseEntity,
  removeEntitySources,
  BaseApplicationService,
  ApplicationServiceDependency,
} from "tandem-common";

import {
  SelectAction,
  SelectAllAction,
  RemoveSelectionAction,
  SelectEntitiesAtSourceOffsetAction,
} from "tandem-front-end/actions";

import { DocumentFile } from "tandem-front-end/models";

@loggable()
export default class SelectorService extends BaseApplicationService<FrontEndApplication> {

  [SelectEntitiesAtSourceOffsetAction.SELECT_ENTITIES_AT_SOURCE_OFFSET](action: SelectEntitiesAtSourceOffsetAction) {

    const selectableEntities = this.app.workspace.file.entity.flatten().filter((entity: IEntity) => {
      return String((<DocumentFile<any>>entity.source.source).path).indexOf(action.filePath) !== -1 && entity.metadata.get(MetadataKeys.SELECTABLE) !== false;
    });

    const selection = [];
    const selectedSources = [];

    for (const entity of selectableEntities) {

      const position = entity.source.position;

      // since the source can be anything -- even binary format,
      // we'll need to verify here that the source does indeed have a position
      // property
      if (position) {
        for (const cursor of action.data) {
          if (
            (cursor.start >= position.start && cursor.start <= position.end) ||
            (cursor.end   >= position.start && cursor.end <= position.end) ||
            (cursor.start <= position.start && cursor.end >= position.end)
          ) {

            const parentIndex = selection.indexOf(entity.parent);

            // there are cases where registered components will use the same source -- skip them.
            if (selectedSources.indexOf(entity.source) !== -1) continue;

            if (parentIndex > -1) {
              selection.splice(parentIndex, 1);
            }

            selection.push(entity);
            selectedSources.push(entity.source);
          }
        }
      }
    }

    this.bus.execute(new SelectAction(selection, false, false));
  }

  /**
   */

  async [RemoveSelectionAction.REMOVE_SELECTION]() {
    await removeEntitySources(...this.app.workspace.selection);
    this.bus.execute(new SelectAction());
  }

  /**
   */

  [SelectAction.SELECT]({ items, toggle, keepPreviousSelection }) {
    const app = this.app;

    if (!items.length) {
      return app.workspace.selection = [];
    }
    const prevSelection = app.workspace.selection;

    const type = items[0].type;

    const newSelection = [];

    if (keepPreviousSelection) {
      newSelection.push(...prevSelection);
    } else {
      newSelection.push(...prevSelection.filter((item) => !!~items.indexOf(item)));
    }

    for (const item of items) {
      const i = newSelection.indexOf(item);
      if (~i) {
        if (toggle) {
          newSelection.splice(i, 1);
        }
      } else {
        newSelection.push(item);
      }
    }

    // parents and children cannot be selected. For now - deselect
    // parent entities that appear in the selection
    newSelection.concat().forEach((entity: IEntity) => {
      let i;
      if (entity.parent && (i = newSelection.indexOf(entity.parent)) !== -1) {
        newSelection.splice(i, 1);
      }
    });

    app.workspace.selection = newSelection;

  }

  [SelectAllAction.SELECT_ALL]() {

    // TODO - select call based on focused entity
    this.bus.execute(new SelectAction((<any>this.app.workspace.file.entity).children, false, false));
  }
}

export const dependency = new ApplicationServiceDependency("selector", SelectorService);