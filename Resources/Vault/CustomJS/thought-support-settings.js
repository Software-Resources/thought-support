class ThoughtSupportSettings {
  SETTINGS_TAGS = ["#Settings", "#Thought-Support"];
  get(key) {
    const dv = window.app.plugins.plugins.dataview.api;
    const settingsPages = dv.pages(this.SETTINGS_TAGS.join(" and "));
    for (const page of settingsPages) {
      if (typeof page.file.frontmatter[key] !== "undefined") {
        return page.file.frontmatter[key];
      }
    }
    throw new Error("No such setting: " + key);
  }
}
