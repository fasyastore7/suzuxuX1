const fs = require("fs");
const path = require("path");
const PluginTemplate = require("@start/plugin/pluginTemplate");
const {
time: { delayWithClock }
} = require("@lib/shared/helpers");

class MenuButtonPlugin extends PluginTemplate {
constructor() {
super();
this.name = "menu"; // hanya untuk tombol interaktif
this.aliases = [];
this.description = "Menampilkan tombol menu utama";
this.usage = ".menu";
this.category = "OWNER";
}

async register(context) {
this.context = context;
}

async execute(message, socket) {
const { pushName, remoteJid } = message;
const botName = this.context.config?.bot_name || "SuzuxuBot";
const thumbnail = fs.readFileSync(
path.join(process.cwd(), "start", "database", "assets", "allmenu.jpg")
);
const ch = "https://whatsapp.com/channel/0029Vb6N37MHQbS0G2kLYW0o";

await delayWithClock(message.m, socket, 1);  

const menuText = `*Hallo ${pushName}*\nSilakan pilih kategori menu:`;  

await socket.sendMessage(  
  remoteJid,  
  {  
    image: thumbnail,  
    caption: menuText,  
    footer: "SuzuxuBot by Fasya",  
    headerType: 1,  
    viewOnce: true,  
    buttons: [  
      {  
        buttonId: `.owner`,  
        buttonText: { displayText: "Contact Owner" },  
        type: 1  
      },  
      {  
        buttonId: `.tqto`,  
        buttonText: { displayText: "Thanks To" },  
        type: 1  
      },  
      {  
        buttonId: "action",  
        buttonText: { displayText: "Select This Menu" },  
        type: 4,  
        nativeFlowInfo: {  
          name: "single_select",  
          paramsJson: JSON.stringify({  
            title: "Select This Menu",  
            sections: [  
              {  
                title: "Kategori Menu",  
                highlight_label: "Menu Utama",  
                rows: [  
                  { title: "ALL MENU", id: ".allmenu" },  
                  { title: "OWNER MENU", id: ".owner" },  
                  { title: "ANIME MENU", id: ".anime" },  
                  { title: "PANEL MENU", id: ".panel" },  
                  { title: "TOOLS MENU", id: ".tools" },  
                  { title: "GROUP MENU", id: ".admin" }  
                ]  
              }  
            ]  
          })  
        }  
      }  
    ],  
    contextInfo: {  
      mentionedJid: [message.sender],  
      forwardingScore: 999,  
      isForwarded: true,  
      forwardedNewsletterMessageInfo: {  
        newsletterName: "Suzuxu Official",  
        newsletterJid: "120363345772469517@newsletter"  
      },  
      externalAdReply: {  
        showAdAttribution: true,  
        title: botName,  
        body: "Menu Interaktif",
        thumbnail,
        sourceUrl: ch,  
        mediaType: 1,  
        renderLargerThumbnail: true  
      }  
    }  
  },  
  { quoted: message.m }  
);

}
}

module.exports = new MenuButtonPlugin();

