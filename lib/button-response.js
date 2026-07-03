module.exports = function (m) {
    if (typeof m.text !== "string") m.text = "";

    if (
        m.mtype === "buttonsResponseMessage" ||
        m.mtype === "listResponseMessage" ||
        m.mtype === "templateButtonReplyMessage"
    ) {
        let selectedId =
            m.msg.selectedId ||
            m.msg.selectedButtonId ||
            m.msg.singleSelectReply?.selectedRowId ||
            "";
        if (selectedId) {
            m.text = selectedId;
            
            // Auto response untuk button dengan multi-bahasa
            const responses = {
                // Contoh response untuk button menu
                "menu": {
                    id: "✅ Menu berhasil dibuka!",
                    en: "✅ Menu successfully opened!",
                    zh: "✅ 菜单成功打开！"
                },
                // Contoh response untuk button status
                "status": {
                    id: "📊 Status bot sedang aktif.",
                    en: "📊 Bot status is active.",
                    zh: "📊 机器人状态活跃。"
                },
                // Contoh response untuk button owner
                "owner": {
                    id: "👤 Ini adalah kontak owner bot.",
                    en: "👤 This is the bot owner's contact.",
                    zh: "👤 这是机器人所有者的联系方式。"
                },
                // Contoh response untuk button donate
                "donate": {
                    id: "💖 Terima kasih atas donasi Anda!",
                    en: "💖 Thank you for your donation!",
                    zh: "💖 感谢您的捐赠！"
                },
                // Contoh response untuk button speed
                "speed": {
                    id: "⚡ Kecepatan respons bot normal.",
                    en: "⚡ Bot response speed is normal.",
                    zh: "⚡ 机器人响应速度正常。"
                }
            };

            // Dapatkan response berdasarkan selectedId
            const response = responses[selectedId.toLowerCase()];
            
            if (response) {
                // Deteksi bahasa user dari database atau default ke Indonesia
                const userLang = global.db.data.users[m.sender]?.language || "id";
                
                let replyText = "";
                if (userLang === "en") {
                    replyText = response.en;
                } else if (userLang === "zh") {
                    replyText = response.zh;
                } else {
                    replyText = response.id;
                }

                // Tambahkan footer info
                const footer = "\n\n───────────────────\n_✍️ Git push by qwen coder edit by canzy_";
                
                m.reply(replyText + footer);
            }
        }
    } else if (m.mtype === "interactiveResponseMessage") {
        let paramsJson = m.msg.nativeFlowResponseMessage?.paramsJson || m.msg.paramsJson || "";
        if (paramsJson) {
            try {
                let parsed = JSON.parse(paramsJson);
                if (parsed.id) {
                    m.text = parsed.id;
                    
                    // Auto response untuk interactive button dengan multi-bahasa
                    const responses = {
                        "menu": {
                            id: "✅ Menu berhasil dibuka!",
                            en: "✅ Menu successfully opened!",
                            zh: "✅ 菜单成功打开！"
                        },
                        "status": {
                            id: "📊 Status bot sedang aktif.",
                            en: "📊 Bot status is active.",
                            zh: "📊 机器人状态活跃。"
                        },
                        "owner": {
                            id: "👤 Ini adalah kontak owner bot.",
                            en: "👤 This is the bot owner's contact.",
                            zh: "👤 这是机器人所有者的联系方式。"
                        },
                        "donate": {
                            id: "💖 Terima kasih atas donasi Anda!",
                            en: "💖 Thank you for your donation!",
                            zh: "💖 感谢您的捐赠！"
                        },
                        "speed": {
                            id: "⚡ Kecepatan respons bot normal.",
                            en: "⚡ Bot response speed is normal.",
                            zh: "⚡ 机器人响应速度正常。"
                        }
                    };

                    const response = responses[parsed.id.toLowerCase()];
                    
                    if (response) {
                        const userLang = global.db.data.users[m.sender]?.language || "id";
                        
                        let replyText = "";
                        if (userLang === "en") {
                            replyText = response.en;
                        } else if (userLang === "zh") {
                            replyText = response.zh;
                        } else {
                            replyText = response.id;
                        }

                        const footer = "\n\n───────────────────\n_✍️ Git push by qwen coder edit by canzy_";
                        
                        m.reply(replyText + footer);
                    }
                }
            } catch (e) {}
        }
    }
};
