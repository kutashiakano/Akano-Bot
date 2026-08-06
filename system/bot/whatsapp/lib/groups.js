const { proto, prepareMessageFromContent } = require("baileys");

function extendGroups(sock) {
  sock.sendGroupV4Invite = async (
    jid,
    participant,
    inviteCode,
    inviteExpiration,
    groupName = "unknown subject",
    caption = "Invitation to join my WhatsApp group",
    options = {}
  ) => {
    let msg = proto.Message.fromObject({
      groupInviteMessage: proto.GroupInviteMessage.fromObject({
        inviteCode,
        inviteExpiration:
          parseInt(inviteExpiration) || +new Date(new Date() + 3 * 86400000),
        groupJid: jid,
        groupName: groupName ? groupName : await sock.getName(jid),
        caption,
      }),
    });
    let message = await prepareMessageFromContent(participant, msg, options);
    await sock.relayMessage(participant, message.message, { messageId: message.key.id });
    return message;
  };

  sock.sendPoll = async (jid, name = "", optiPoll, options = {}) => {
    if (!Array.isArray(optiPoll[0]) && typeof optiPoll[0] === "string") {
      optiPoll = [optiPoll];
    }
    const pollMessage = {
      name: name,
      options: optiPoll.map((btn) => ({
        optionName: btn[0] || "",
      })),
      selectableOptionsCount: 1,
    };
    return sock.relayMessage(
      jid,
      {
        pollCreationMessage: pollMessage,
      },
      options
    );
  };
}

module.exports = { extendGroups };
