import * as path from 'path';
import { Application } from 'sf-common/applications';

import { fragment as dbServiceFragment } from './services/db';
import { fragment as fileServicerFragment } from './services/file';
import { fragment as stdinServiceFragment } from './services/stdin';
import { fragment as upsertServiceFragment } from './services/upsert';
import { fragment as frontEndServiceFragment } from './services/front-end';

export default class ServerApplication extends Application {
  constructor(config) {
    super(Object.assign({
      frontEndEntry: require.resolve('sf-front-end')
    }, config));
  }
  registerFragments() {
    super.registerFragments();
    this.fragments.register(
      dbServiceFragment,
      fileServicerFragment,
      stdinServiceFragment,
      upsertServiceFragment,
      frontEndServiceFragment
    );
  }
}
