import React, {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

export const StoreContext = createContext(null);

export function Surface({
  tag: Tag = "div",
  id,
  className,
  children,
  ...props
}) {
  const store = useContext(StoreContext);
  const getShown = useCallback(() => {
    const state = store.getSnapshot();
    return className === "overlay" ? !!state.overlays[id] : state.screen === id;
  }, [store, id, className]);
  const shown = useSyncExternalStore(store.subscribe, getShown);
  return (
    <Tag {...props} id={id} className={className + (shown ? " show" : "")}>
      {children}
    </Tag>
  );
}
