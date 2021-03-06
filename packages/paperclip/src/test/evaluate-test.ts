import { expect } from "chai";
import { evaluatePCModule } from "../evaluate";
import { Frame, createSyntheticElement } from "..";
import { values } from "lodash";
import {
  PCModule,
  PAPERCLIP_MODULE_VERSION,
  PCSourceTagNames,
  createPCComponent,
  createPCElement,
  createPCModule,
  createPCComponentInstance,
  createPCVariant,
  getPCNodeDependency,
  createPCDependency,
  createPCOverride,
  PCOverridablePropertyName
} from "../dsl";
import {
  generateUID,
  generateTreeChecksum,
  cloneTreeNode,
  createTreeNode,
  appendChildNode
} from "tandem-common";
import { DependencyGraph } from "../graph";
import { translateAbsoluteToRelativePoint } from "tandem-common/lib/utils/transform";

describe(__filename + "#", () => {
  type EvaluateCases = Array<[PCModule, Frame[]]>;

  const defaultBounds = {
    left: 0,
    top: 0,
    right: 100,
    bottom: 100
  };

  const createFakeGraph = (...modules: PCModule[]) => {
    const graph: DependencyGraph = {};
    let i = 0;
    for (const module of modules) {
      graph[++i] = createPCDependency(String(i), module);
    }
    return graph;
  };

  const nodeIdCleaner = (i = 0) => {
    let alreadyReset: any = {};
    return node => {
      return cloneTreeNode(node, child => {
        if (alreadyReset[child.id]) return child.id;
        const newId = String("00000000" + i++);
        alreadyReset[newId] = 1;
        return newId;
      });
    };
  };

  it("can evaluate a simple component", () => {
    const module = nodeIdCleaner()(
      createPCModule([
        createPCComponent("Test", "body", { a: "b" }, {}, [
          createPCElement("div", { a: "b2" }, { c: "d" })
        ])
      ])
    );

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(document.children.length).to.eql(1);

    expect(nodeIdCleaner()(document.children[0])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "body",
          { nodeId: "000000001" },
          { a: "b" },
          {},
          [
            createSyntheticElement(
              "div",
              { nodeId: "000000002" },
              { a: "b2" },
              { c: "d" },
              [],
              undefined,
              false,
              true,
              false,
              false
            )
          ],
          "Test",
          true,
          true,
          false,
          false
        )
      )
    );
  });

  it("can evaluate an instance of a component", () => {
    const cleanIds = nodeIdCleaner();

    const component = cleanIds(
      createPCComponent("Test", "body", { a: "b" }, { c: "a" }, [
        createPCElement("div", { a: "b2" }, { c: "d" })
      ])
    );

    const module = cleanIds(
      createPCModule([
        component,
        createPCComponentInstance(component.id, null, { a: "b3" }, { c: "d" })
      ])
    );

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(document.children.length).to.eql(2);

    expect(nodeIdCleaner()(document.children[1])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "body",
          { nodeId: "000000003" },
          { a: "b3" },
          { c: "d" },
          [
            createSyntheticElement(
              "div",
              { nodeId: "000000001" },
              { a: "b2" },
              { c: "d" },
              [],
              undefined,
              false,
              true,
              false,
              true
            )
          ],
          "Test",
          true,
          true,
          true,
          false
        )
      )
    );
  });

  it("components can extend existing components", () => {
    const cleanIds = nodeIdCleaner();

    const component1 = cleanIds(
      createPCComponent("Test", "div", { a: "b" }, { c: "a" }, [
        createPCElement("div", { a: "b2" }, { c: "d" })
      ])
    );

    const component2 = cleanIds(
      createPCComponent("Test", component1.id, { a: "b2" }, { c: "a2" }, [])
    );

    const module = cleanIds(createPCModule([component1, component2]));

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(document.children.length).to.eql(2);

    expect(nodeIdCleaner()(document.children[1])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "div",
          { nodeId: "000000002" },
          { a: "b2" },
          { c: "a2" },
          [
            createSyntheticElement(
              "div",
              { nodeId: "000000001" },
              { a: "b2" },
              { c: "d" },
              [],
              undefined,
              false,
              true,
              false,
              true
            )
          ],
          "Test",
          true,
          true,
          false,
          false
        )
      )
    );
  });

  it("extended components can provide slots to parent components", () => {
    const cleanIds = nodeIdCleaner();

    const container = cleanIds(createPCElement("div", { a: "b2" }, { c: "d" }));

    const component1 = cleanIds(
      createPCComponent("Test", "div", { a: "b" }, { c: "a" }, [container])
    );

    const component2 = cleanIds(
      createPCComponent("Test", component1.id, { a: "b2" }, { c: "a2" }, [
        createPCOverride([container.id], PCOverridablePropertyName.CHILDREN, [
          createPCElement("div", { a: "bb" }, { c: "dd" })
        ])
      ])
    );

    const module = cleanIds(createPCModule([component1, component2]));

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(document.children.length).to.eql(2);

    expect(nodeIdCleaner()(document.children[1])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "div",
          { nodeId: "000000002" },
          { a: "b2" },
          { c: "a2" },
          [
            createSyntheticElement(
              "div",
              { nodeId: "000000000" },
              { a: "b2" },
              { c: "d" },
              [
                createSyntheticElement(
                  "div",
                  { nodeId: "000000004" },
                  { a: "bb" },
                  { c: "dd" },
                  [],
                  undefined,
                  false,
                  true,
                  false,
                  false
                )
              ],
              undefined,
              false,
              true,
              false,
              true
            )
          ],
          "Test",
          true,
          true,
          false,
          false
        )
      )
    );
  });

  it("can extend a component 4 levels up", () => {
    const cleanIds = nodeIdCleaner();

    const container1 = cleanIds(createPCElement("a", {}, {}));
    const component1 = cleanIds(
      createPCComponent("Test", "div", { color: "red" }, {}, [container1])
    );

    const container2 = cleanIds(createPCElement("b", {}, {}));
    const component2 = cleanIds(
      createPCComponent("Test", component1.id, { color: "green" }, {}, [
        createPCOverride([container1.id], PCOverridablePropertyName.CHILDREN, [
          container2,
          createPCElement("b2", {}, {})
        ])
      ])
    );

    const container3 = cleanIds(createPCElement("c", {}, {}));
    const component3 = cleanIds(
      createPCComponent("Test", component2.id, { color: "blue" }, {}, [
        createPCOverride([container2.id], PCOverridablePropertyName.CHILDREN, [
          container3
        ])
      ])
    );

    const container4 = cleanIds(createPCElement("d", {}, {}));
    const component4 = cleanIds(
      createPCComponent("Test", component3.id, {}, {}, [
        createPCOverride([container3.id], PCOverridablePropertyName.CHILDREN, [
          container4
        ])
      ])
    );

    const module = cleanIds(
      createPCModule([component1, component2, component3, component4])
    );

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(document.children.length).to.eql(4);

    expect(nodeIdCleaner()(document.children[3])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "div",
          { nodeId: "0000000010" },
          { color: "blue" },
          {},
          [
            createSyntheticElement(
              "a",
              { nodeId: "000000000" },
              {},
              {},
              [
                createSyntheticElement(
                  "b",
                  { nodeId: "000000002" },
                  {},
                  {},
                  [
                    createSyntheticElement(
                      "c",
                      { nodeId: "000000006" },
                      {},
                      {},
                      [
                        createSyntheticElement(
                          "d",
                          { nodeId: "000000009" },
                          {},
                          {},
                          [],
                          undefined,
                          false,
                          true,
                          false,
                          false
                        )
                      ],
                      undefined,
                      false,
                      true,
                      false,
                      true
                    )
                  ],
                  undefined,
                  false,
                  true,
                  false,
                  true
                ),
                createSyntheticElement(
                  "b2",
                  { nodeId: "000000005" },
                  {},
                  {},
                  [],
                  undefined,
                  false,
                  true,
                  false,
                  true
                )
              ],
              undefined,
              false,
              true,
              false,
              true
            )
          ],
          "Test",
          true,
          true,
          false,
          false
        )
      )
    );
  });

  it("can override a nested node style in a component", () => {
    const cleanIds = nodeIdCleaner();

    const container1 = cleanIds(createPCElement("a", { color: "blue" }, {}));
    const component1 = cleanIds(
      createPCComponent("Test", "div", {}, {}, [container1])
    );

    const component2 = cleanIds(
      createPCComponent("Test", component1.id, {}, {}, [
        createPCOverride([container1.id], PCOverridablePropertyName.STYLE, {
          color: "red"
        })
      ])
    );

    const module = cleanIds(createPCModule([component1, component2]));

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(document.children.length).to.eql(2);

    expect(nodeIdCleaner()(document.children[1])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "div",
          { nodeId: "000000002" },
          {},
          {},
          [
            createSyntheticElement(
              "a",
              { nodeId: "000000000" },
              { color: "red" },
              {},
              [],
              undefined,
              false,
              true,
              false,
              true
            )
          ],
          "Test",
          true,
          true,
          false,
          false
        )
      )
    );
  });

  xit("can evaluate a component with a variant", () => {
    const cleanIds = nodeIdCleaner();

    const variant1 = cleanIds(createPCVariant("a"));
    let container1 = cleanIds(
      createPCElement("a", { color: "blue" }, {}, [
        createPCOverride(
          [],
          PCOverridablePropertyName.STYLE,
          { color: "red" },
          variant1.id
        )
      ])
    );

    const component1 = cleanIds(
      createPCComponent("Test", "div", {}, {}, [variant1, container1])
    );

    const module = cleanIds(
      createPCModule([
        component1,
        createPCComponentInstance(component1.id, [variant1.id])
      ])
    );

    const document = evaluatePCModule(module, createFakeGraph(module));

    expect(nodeIdCleaner()(document.children[0])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "div",
          { nodeId: "000000003" },
          {},
          {},
          [
            createSyntheticElement(
              "a",
              { nodeId: "000000001" },
              { color: "blue" },
              {},
              [],
              undefined,
              false,
              true,
              false
            )
          ],
          "Test",
          true,
          true,
          false
        )
      )
    );

    expect(nodeIdCleaner()(document.children[1])).to.eql(
      nodeIdCleaner()(
        createSyntheticElement(
          "div",
          { nodeId: "000000005" },
          {},
          {},
          [
            createSyntheticElement(
              "a",
              { nodeId: "000000001" },
              { color: "red" },
              {},
              [],
              undefined,
              false,
              true,
              false
            )
          ],
          "Test",
          true,
          true,
          true
        )
      )
    );
  });

  xit("merges variants when multiple are applied");
  xit("a variant can be defined by a parent variant");
  xit("multiple component instance children can be overriden");
  xit("can evaluate a component from another module");
});
