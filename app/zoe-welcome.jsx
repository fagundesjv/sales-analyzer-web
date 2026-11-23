import {ChatHome} from "../src/ui/os/chat-home";
import {ZoeAvatar} from "./zoe-avatar";

export function ZoeWelcome({company, contactName, children}) {
  return <ChatHome
    portrait={<span style={{display:"block",width:100,height:100}}><ZoeAvatar expression="wave" /></span>}
    greeting={"Zoe · " + company}
    headline={contactName ? "Como posso ajudar com " + contactName.split(" ")[0] + "?" : "Que venda vamos recuperar hoje?"}
    composer={<div className="sales-chat-start">{children}</div>}
  />;
}
