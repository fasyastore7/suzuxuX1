const PluginTemplate = require("@start/plugin/pluginTemplate");

class TestUpdatePlugin extends PluginTemplate {
  constructor() {
    super();
    this.name = "testupdate";
    this.description = "Plugin dummy untuk uji updateforce";
    this.usage = ".testupdate";
    this.category = "TOOLS";
  }

  async execute(msg) {
    await msg.reply("✅ Ini adalah plugin hasil *updateforce test*.");
  }
}

module.exports = new TestUpdatePlugin();
