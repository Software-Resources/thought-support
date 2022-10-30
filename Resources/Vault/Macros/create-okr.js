module.exports = async (params) => {
  const {
    quickAddApi: { inputPrompt },
    app,
  } = params;

  const { ThoughtSupportSettings } = customJS;

  const TEMPLATES_ROOT = ThoughtSupportSettings.get("templates_root");
  const PROJECTS_ROOT = ThoughtSupportSettings.get("projects_root");
  const TEMPLATE_PAGE_NAME = ThoughtSupportSettings.get(
    "okr_template_page_name"
  );

  const okrName = await inputPrompt("🎯 OKR Name");
  if (!okrName) {
    return;
  }

  await app.vault.createFolder(PROJECTS_ROOT + "/" + okrName);
  const template = {
    path: TEMPLATES_ROOT + "/" + TEMPLATE_PAGE_NAME + ".md",
  };
  await app.vault.copy(
    template,
    PROJECTS_ROOT + "/" + okrName + "/" + okrName + ".md"
  );
};
