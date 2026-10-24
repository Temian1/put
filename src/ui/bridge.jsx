import React, { useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  FoodButtons,
  LevelMap,
  Shop,
  Bubble,
  DailyMods,
} from "./DynamicLayers.jsx";

// Flush only structural changes when the imperative engine immediately needs DOM refs.
// Never send frame positions, score count-ups or particle positions through this store.
export function createUiBridge(store, host) {
  const actions = new Map();
  let serial = 0,
    disposed = false;
  const sync = (patch) => {
    if (!disposed) flushSync(() => store.update(patch));
  };
  const slot = (id, target, element) =>
    sync({
      slots: { ...store.getSnapshot().slots, [id]: { target, element } },
    });
  const bridge = {
    show: (screen) => sync({ screen }),
    overlay: (id, visible) =>
      sync({ overlays: { ...store.getSnapshot().overlays, [id]: visible } }),
    bind: (selector, fn) => actions.set(selector.slice(1), fn),
    handleClick(event) {
      const button = event.target.closest("button");
      if (button && actions.has(button.id))
        actions.get(button.id)({
          currentTarget: button,
          preventDefault: () => event.preventDefault(),
        });
    },
    foods: (foods, data, tap) =>
      slot(
        "foods",
        host.querySelector("#foodBtns"),
        <FoodButtons foods={foods} data={data} tap={tap} />,
      ),
    map: (props) =>
      slot("map", host.querySelector("#mapInner"), <LevelMap {...props} />),
    shop: (props) =>
      slot("shop", host.querySelector("#shopList"), <Shop {...props} />),
    dailyMods: (mods) =>
      slot(
        "dailyMods",
        host.querySelector("#dailyMods"),
        <DailyMods mods={mods} />,
      ),
    caption(cfg, best) {
      const content =
        cfg.mode === "level" ? (
          <>
            Level {cfg.n} <em>· {cfg.title}</em>
          </>
        ) : cfg.mode === "daily" ? (
          <>
            <em>Daily</em> · {cfg.challenge}
          </>
        ) : (
          <>
            <em>Endless Rush</em> · Best {best}
          </>
        );
      slot("caption", host.querySelector("#hudLvl"), content);
    },
    bubble(customer, cols, foods, select) {
      let root;
      slot(
        "bubble-" + customer.id,
        host.querySelector("#world"),
        <Bubble
          customer={customer}
          cols={cols}
          foods={foods}
          select={select}
          rootRef={(el) => {
            root = el;
          }}
        />,
      );
      return root;
    },
    effect(type, { x, y, text, cls }) {
      const id = "effect-" + ++serial;
      let element;
      const props = {
        ref: (el) => {
          element = el;
        },
        style: { left: x, top: y },
      };
      slot(
        id,
        host.querySelector("#fx"),
        type === "coin" ? (
          <i {...props} className="coin fly" />
        ) : (
          <div {...props} className={"ftext " + (cls || "")}>
            {text}
          </div>
        ),
      );
      return { id, element };
    },
    remove(id) {
      const slots = { ...store.getSnapshot().slots };
      delete slots[id];
      sync({ slots });
    },
    dispose() {
      disposed = true;
      actions.clear();
    },
  };
  return bridge;
}

export function PortalLayer({ store }) {
  const { slots } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return Object.entries(slots).map(([key, { target, element }]) =>
    createPortal(element, target, key),
  );
}
