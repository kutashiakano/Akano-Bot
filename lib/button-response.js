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
        if (selectedId) m.text = selectedId;
    } else if (m.mtype === "interactiveResponseMessage") {
        let paramsJson = m.msg.nativeFlowResponseMessage?.paramsJson || m.msg.paramsJson || "";
        if (paramsJson) {
            try {
                let parsed = JSON.parse(paramsJson);
                if (parsed.id) m.text = parsed.id;
            } catch (e) {}
        }
    }
};
