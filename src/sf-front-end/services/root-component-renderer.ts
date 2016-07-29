import * as sift from "sift";
import * as ReactDOM from "react-dom";
import { filterAction, loggable } from "sf-core/decorators";

import { Logger } from "sf-core/logger";
import { IApplication } from "sf-core/application";
import { BaseApplicationService } from "sf-core/services";
import { ClassFactoryFragment } from "sf-core/fragments";
import { ApplicationServiceFragment } from "sf-core/fragments";
import { RootReactComponentFragment } from "sf-front-end/fragments";

@loggable()
export default class RootComponentRenderer extends BaseApplicationService<IApplication> {

  public logger: Logger;
  private _rendering: boolean;

  @filterAction(sift({
    type: {
      $ne: /log/,
    },
  }))
  execute() {
    if (this._rendering) return;
    this._rendering = true;
    setTimeout(this.render, 10);
  }

  render = () => {
    this._rendering = false;
    const app = this.app;

    const rootComponentClassFragment = RootReactComponentFragment.find(this.app.fragments);

    if (!rootComponentClassFragment) {
      this.logger.warn("Root React component was not found.");
      return;
    }

    ReactDOM.render(rootComponentClassFragment.create({

      // deprecated
      app: app,

      // deprecated
      bus: app.bus,
      fragments: app.fragments
    }), app.config.element);
  }
}

export const fragment = new ApplicationServiceFragment("root-component-renderer", RootComponentRenderer);