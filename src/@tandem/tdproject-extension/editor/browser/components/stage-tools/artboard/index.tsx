import "./index.scss";
import * as React from "react";
import * as AutosizeInput from "react-input-autosize";

import { Status } from "@tandem/common/status";
import * as tc from "tinycolor2";
import { SyntheticTDArtboardElement } from "@tandem/tdproject-extension/synthetic";
import { BoundingRect, BaseApplicationComponent, PropertyMutation } from "@tandem/common";
import { ApplyFileEditRequest } from "@tandem/sandbox";
import { Workspace, SelectRequest, StatusComponent } from "@tandem/editor/browser";
import { SyntheticHTMLElement, SyntheticDOMElementEdit } from "@tandem/synthetic-browser";

export class TDArtboardComponent extends BaseApplicationComponent<{ artboard: SyntheticTDArtboardElement, workspace: Workspace, backgroundColor: string }, {
  edit: SyntheticDOMElementEdit,
  titleEditChange: PropertyMutation<any>
}> {

  $didInject() {
    super.$didInject();
    this.state = {
      edit: undefined,
      titleEditChange: undefined
    };
  }

  editTitle = () => {
    if (!this.props.artboard.source) return;

    const { artboard } = this.props;
    const edit = artboard.createEdit();

    this.setState({
      edit: edit,
      titleEditChange: edit.setAttribute("title", this.props.artboard.getAttribute("title"))
    });

    // rAF since the input may not be available immediately
    requestAnimationFrame(() => {
      (this.refs as any).input.select();
    });
  }

  onTitleChange = (event) => {
    this.state.titleEditChange.newValue = event.target.value;
    this.forceUpdate();
  }

  cancelEdit = () => {
    this.doneEditing();
  }

  save = async () => {
    const { artboard } = this.props;

    // apply the change back to the element so that the user sees
    // the change immediately
    this.state.edit.applyActionsTo(artboard);

    await this.bus.dispatch(new ApplyFileEditRequest(this.state.edit.mutations));
    this.doneEditing();
  }

  doneEditing = () => {
    this.setState({ titleEditChange: undefined, edit: undefined });
  }

  selectEntity = (event: React.MouseEvent<any>) => {
    this.props.workspace.select(this.props.artboard, event.metaKey || event.shiftKey);
  }

  onKeyDown = (event: React.KeyboardEvent<any>): any => {
    const keyCode = event.which;
    switch (event.which) {
      case 27: return this.cancelEdit();
      case 13: return this.save();
    }
  }

  render() {
    const { artboard, workspace } = this.props;

    // TODO - get absolute bounds here
    const bounds = artboard.getBoundingClientRect();
    const scale = 1 / workspace.transform.scale;

    const style = {
      left   : bounds.left,
      top    : bounds.top,
      width  : bounds.width,
      height : bounds.height
    };

    const fontSize = 12;

    const colorInf = tc(this.props.backgroundColor);

    const titleStyle = {
      position: "absolute",
      color: colorInf.isLight() || colorInf.getAlpha() < 0.3 ? `rgba(0,0,0,0.5)` : `rgba(255, 255, 255, 0.8)`,
      display: workspace.transform.scale > 0.2 ? "block" : "none",
      top: 0,
      fontSize: 12,
      transform: `translateY(${-25 * scale}px) scale(${scale})`,
      transformOrigin: "top left"
    };

    return <div className="m-tdartboard-stage-tool--item" style={style}>
      <div className="m-tdartboard-stage-tool--item--title" onClick={this.selectEntity} onDoubleClick={this.editTitle} style={titleStyle}>
        { this.state.titleEditChange ? <AutosizeInput ref="input" value={this.state.titleEditChange.newValue} onChange={this.onTitleChange} onBlur={this.cancelEdit} onKeyDown={this.onKeyDown} /> : <span>{artboard.title || "Untitled"}</span> }
        <StatusComponent status={artboard.status} />
      </div>
    </div>;
  }
}

export class TDArtboardStageToolComponent extends React.Component<{ workspace: Workspace }, any> {
  render() {
    const { workspace } = this.props;
    const { document, transform } = workspace;

    const tandem    = document.querySelector("tandem") as SyntheticHTMLElement;
    const artboards = document.querySelectorAll("artboard") as SyntheticTDArtboardElement[];

    if (!artboards.length) return null;

    const backgroundStyle = {
      backgroundColor: "rgba(0,0,0,0.02)",
      transform: `translate(${-transform.left / transform.scale}px, ${-transform.top / transform.scale}px) scale(${1 / transform.scale}) translateZ(0)`,
      transformOrigin: "top left"
    };

    if (tandem) {
      Object.assign(backgroundStyle, tandem.style);
    }

    return <div className="m-tdartboard-stage-tool">
      <div style={backgroundStyle} className="m-tdartboard-stage-tool--background" />
      {
        artboards.map((artboard) => {
          return <TDArtboardComponent key={artboard.uid} workspace={workspace} artboard={artboard} backgroundColor={backgroundStyle.backgroundColor} />;
        })
      }
    </div>;
  }
}