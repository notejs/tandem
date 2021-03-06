import "./index.scss";
import * as React from "react";
import { Dispatch } from "redux";
import { PaneComponent } from "../../../../pane";
const { Item: BaseItem } = require("./index.pc");
import {
  REGISTERED_COMPONENT,
  RegisteredComponent
} from "../../../../../state";
import { createTreeNode } from "tandem-common";
import { compose, pure, withHandlers } from "recompose";
import { DropTarget, DragSource, DropTargetCollector } from "react-dnd";

type ListItem = {
  label: string;
} & RegisteredComponent;

const NATIVE_ELEMENTS: ListItem[] = [
  { tagName: "div", label: "Div", template: createTreeNode("template") },
  {
    tagName: "text",
    label: "Text",
    template: createTreeNode("edit me")
  }
];

type NativeElementOuterProps = {
  item: ListItem;
};

type NativeElementInnerProps = {
  connectDragSource: any;
} & NativeElementOuterProps;

const BaseNativeElementComponent = ({
  item,
  connectDragSource
}: NativeElementInnerProps) => {
  return connectDragSource(
    <div>
      <BaseItem className="m-component-cell" labelChildren={item.label} />
    </div>
  );
};

const NativeElementComponent = compose<
  NativeElementInnerProps,
  NativeElementOuterProps
>(
  pure,
  DragSource(
    REGISTERED_COMPONENT,
    {
      beginDrag({ item }: NativeElementOuterProps) {
        return item;
      }
    },
    (connect, monitor) => ({
      connectDragSource: connect.dragSource(),
      connectDragPreview: connect.dragPreview(),
      isDragging: monitor.isDragging()
    })
  )
)(BaseNativeElementComponent);

type ComponentsPaneOuterProps = {
  dispatch: Dispatch<any>;
};

type ComponentsPaneInnerProps = {} & ComponentsPaneOuterProps;

const BaseComponentsPaneComponent = (props: ComponentsPaneInnerProps) => {
  return (
    <PaneComponent header="Native Elements">
      {NATIVE_ELEMENTS.map((item, i) => {
        return <NativeElementComponent key={i} item={item} />;
      })}
    </PaneComponent>
  );
};

export const ComponentsPaneComponent = compose<
  ComponentsPaneInnerProps,
  ComponentsPaneOuterProps
>(pure)(BaseComponentsPaneComponent);
