declare module "cytoscape-fcose" {
  // The fcose layout extension is registered with `cytoscape.use()`. It does
  // not ship type definitions, so we expose it as the loose function shape
  // expected by `cytoscape.use`.
  const ext: cytoscape.Ext;
  export default ext;
}
