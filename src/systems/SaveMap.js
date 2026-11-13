// Empty JSON objects can return from PHP as arrays. String-keyed properties
// on an array disappear when JSON.stringify persists the save.
export const saveMap = (value) =>
  value && typeof value === "object" ? { ...value } : {};
