/**
 * Hearth Messenger design reminder: premium conversational utility—clear hierarchy, familiar
 * messenger mechanics, warm private cues, and a mobile-first message canvas.
 */
import { useMemo, useState } from "react";
import {
  CheckCheck,
  CircleAlert,
  ImagePlus,
  Info,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FamilyMember, FamilyMessage, LocalIdentity } from "@/lib/nostr";
import { displayNpub, shortKey } from "@/lib/nostr";

const sealUrl = "/manus-storage/hearthline-seal_f89e7d2b.png";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

type MessengerWorkspaceProps = {
  identity: LocalIdentity;
  familyName: string;
  familyRole: "owner" | "member";
  visibleMembers: FamilyMember[];
  members: FamilyMember[];
  memberByKey: Map<string, FamilyMember>;
  messages: FamilyMessage[];
  connection: ConnectionState;
  connectionNote: string;
  relayUrl: string;
  settingsRelayUrl: string;
  setSettingsRelayUrl: (value: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
  onCreateInvite: () => Promise<string | null>;
  onRemoveMember: (pubkey: string) => void;
  onUpdateRelay: () => void;
  onForgetDevice: () => void;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function messageTime(seconds: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(seconds * 1000));
}

function ConnectionDot({ state }: { state: ConnectionState }) {
  return <span className={`connection-dot connection-dot--${state}`} aria-hidden="true" />;
}

function FamilyOrbit({ members, className = "" }: { members: FamilyMember[]; className?: string }) {
  return (
    <span className={`family-orbit ${className}`} aria-label="Family conversation">
      <span>{initials(members[0]?.name ?? "F")}</span>
      <span>{initials(members[1]?.name ?? "H")}</span>
    </span>
  );
}

export default function MessengerWorkspace({
  identity,
  familyName,
  familyRole,
  visibleMembers,
  members,
  memberByKey,
  messages,
  connection,
  connectionNote,
  relayUrl,
  settingsRelayUrl,
  setSettingsRelayUrl,
  draft,
  setDraft,
  isSending,
  onSend,
  onCreateInvite,
  onRemoveMember,
  onUpdateRelay,
  onForgetDevice,
}: MessengerWorkspaceProps) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [latestInvite, setLatestInvite] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return query ? visibleMembers.filter((member) => member.name.toLowerCase().includes(query)) : visibleMembers;
  }, [memberSearch, visibleMembers]);
  const latestMessage = messages.length ? messages[messages.length - 1] : null;

  const createInvite = async () => {
    setIsCreatingInvite(true);
    const code = await onCreateInvite();
    if (code) setLatestInvite(code);
    setIsCreatingInvite(false);
  };

  const appendEmoji = (emoji: string) => {
    setDraft(`${draft}${draft ? " " : ""}${emoji}`);
    setShowEmojiPicker(false);
  };

  return (
    <main className="chat-app overflow-hidden text-[#26302d]">
      <div className="messenger-layout h-full">
        <aside className={`chat-sidebar ${showSidebar ? "chat-sidebar--open" : ""}`} aria-label="Family conversations">
          <div className="chat-sidebar-head">
            <div className="brand-lockup"><img src={sealUrl} alt="Family Chat" /><span>Family Chat</span></div>
            <div className="flex items-center gap-1"><button type="button" onClick={() => setShowPeople(true)} className="icon-button" aria-label="Manage family"><UsersRound className="h-4 w-4" /></button><button type="button" onClick={() => setShowSidebar(false)} className="icon-button lg:hidden" aria-label="Close conversations"><X className="h-4 w-4" /></button></div>
          </div>

          <label className="sidebar-search"><Search className="h-4 w-4" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search family" aria-label="Search family members" /></label>

          <div className="chat-list">
            <button type="button" className="conversation-item conversation-item--active">
              <FamilyOrbit members={visibleMembers} />
              <span className="min-w-0 flex-1 text-left"><span className="conversation-title">{familyName}</span><span className="conversation-preview">{latestMessage ? `${memberByKey.get(latestMessage.author)?.name ?? "Someone"}: ${latestMessage.content}` : "Your private family room"}</span></span>
              <span className="conversation-time">{latestMessage ? messageTime(latestMessage.createdAt) : ""}</span>
            </button>
          </div>

          <div className="sidebar-section-head"><span>People</span><button type="button" onClick={() => setShowPeople(true)} aria-label="Add family member"><Plus className="h-4 w-4" /></button></div>
          <div className="people-list">
            {filteredMembers.map((member) => {
              const isSelf = member.pubkey === identity.pubkey;
              return <div key={member.pubkey} className="person-item"><span className={`person-avatar ${isSelf ? "person-avatar--self" : ""}`}>{initials(member.name)}</span><span className="min-w-0 flex-1 truncate">{isSelf ? `${member.name} (You)` : member.name}</span><span className={`presence-dot ${connection === "connected" ? "presence-dot--on" : ""}`} /></div>;
            })}
          </div>

          <div className="sidebar-foot"><button type="button" onClick={() => setShowSettings(true)} className="self-card"><span className="person-avatar person-avatar--self">{initials(visibleMembers.find((member) => member.pubkey === identity.pubkey)?.name ?? "You")}</span><span className="min-w-0 flex-1 text-left"><strong>{visibleMembers.find((member) => member.pubkey === identity.pubkey)?.name ?? "You"}</strong><small>{connection === "connected" ? "Connected privately" : "Relay unavailable"}</small></span><Settings2 className="h-4 w-4" /></button></div>
        </aside>

        <section className="messenger-pane relative flex h-full min-w-0 flex-col">
          <header className="messenger-header">
            <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setShowSidebar(true)} className="icon-button lg:hidden" aria-label="Open conversations"><Menu className="h-5 w-5" /></button><FamilyOrbit members={visibleMembers} className="family-orbit--header" /><div className="min-w-0"><h1>{familyName}</h1><p><ConnectionDot state={connection} />{connection === "connected" ? `${Math.max(visibleMembers.length - 1, 0)} members · Private relay` : connection === "connecting" ? "Connecting to relay" : "Relay needs attention"}</p></div></div>
            <div className="flex items-center gap-1"><button type="button" onClick={() => setShowPeople(true)} className="header-action"><UsersRound className="h-4 w-4" /><span className="hidden sm:inline">People</span></button><button type="button" onClick={() => setShowSettings(true)} className="icon-button" aria-label="Room settings"><Info className="h-5 w-5" /></button><button type="button" className="icon-button" onClick={() => setShowSettings(true)} aria-label="More options"><MoreHorizontal className="h-5 w-5" /></button></div>
          </header>

          <div className="message-scroll min-h-0 flex-1 overflow-y-auto" role="log" aria-label="Family message history" tabIndex={0}>
            <div className="message-stage">
              <div className="privacy-banner"><LockKeyhole className="h-3.5 w-3.5" /><span>Messages are sealed for this family room</span></div>
              {messages.length === 0 ? (
                <div className="messenger-empty"><span className="empty-seal"><img src={sealUrl} alt="" /></span><h2>Your family room is ready</h2><p>Start the conversation. Messages are encrypted before they leave this device.</p><button type="button" onClick={() => setShowPeople(true)}><UsersRound className="h-4 w-4" />{familyRole === "owner" ? "Invite family members" : "See family members"}</button></div>
              ) : (
                <div className="message-feed">
                  {messages.map((message) => {
                    const author = memberByKey.get(message.author);
                    const isSelf = message.author === identity.pubkey;
                    return <article key={message.id} className={`chat-message ${isSelf ? "chat-message--own" : ""}`}>
                      {!isSelf && <span className="person-avatar chat-message-avatar">{initials(author?.name ?? shortKey(message.author, 2))}</span>}
                      <div className="chat-message-content">{!isSelf && <span className="chat-message-name">{author?.name ?? shortKey(message.author)}</span>}<p className="chat-bubble">{message.content}</p><span className="chat-message-meta">{messageTime(message.createdAt)}{isSelf && <><span>·</span><CheckCheck className="h-3.5 w-3.5" /></>}</span></div>
                    </article>;
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="composer-area">
            {showEmojiPicker && <div className="emoji-popover" role="dialog" aria-label="Choose an emoji">{["❤️", "👍", "😂", "🎉", "🙏", "✨"].map((emoji) => <button key={emoji} type="button" onClick={() => appendEmoji(emoji)}>{emoji}</button>)}</div>}
            <div className="chat-composer">
              <button type="button" className="composer-icon" onClick={() => setShowPeople(true)} aria-label="Add people"><Plus className="h-5 w-5" /></button>
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} disabled={connection !== "connected" || members.length < 2} placeholder={members.length < 2 ? "Add a family member to begin…" : connection === "connected" ? "Message the family" : "Reconnect to send a message"} className="chat-textarea" />
              <button type="button" className="composer-icon" onClick={() => setShowEmojiPicker((current) => !current)} aria-label="Add emoji"><Smile className="h-5 w-5" /></button>
              <Button onClick={onSend} disabled={!draft.trim() || isSending || connection !== "connected" || members.length < 2} className="chat-send" aria-label="Send message">{isSending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</Button>
            </div>
            <p className="composer-note"><LockKeyhole className="h-3 w-3" />Encrypted on this device · Press Enter to send</p>
          </div>
        </section>
      </div>

      {showPeople && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPeople(false)}><section className="hearth-modal messenger-modal" role="dialog" aria-modal="true" aria-labelledby="people-title" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-5"><div><p className="modal-kicker">Family space</p><h2 id="people-title">People</h2></div><button type="button" onClick={() => setShowPeople(false)} className="modal-close" aria-label="Close"><X className="h-4 w-4" /></button></div><p className="modal-copy">Members are verified by this family space. {familyRole === "owner" ? "Create an invite code to add someone without sharing keys." : "Ask a family owner for an invite code to add another device."}</p>{familyRole === "owner" && <div className="add-person-form"><Button onClick={() => void createInvite()} disabled={isCreatingInvite} className="hearth-primary">{isCreatingInvite ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create invite code</Button>{latestInvite && <Input value={latestInvite} readOnly className="font-mono text-xs" aria-label="Latest family invite code" />}</div>}<div className="people-modal-list">{visibleMembers.map((member) => <div key={member.pubkey} className="people-modal-row"><span className="person-avatar">{initials(member.name)}</span><span className="min-w-0 flex-1"><strong>{member.pubkey === identity.pubkey ? `${member.name} (You)` : member.name}</strong><small>{shortKey(member.pubkey, 10)}</small></span>{familyRole === "owner" && member.pubkey !== identity.pubkey && <button type="button" onClick={() => onRemoveMember(member.pubkey)} aria-label={`Remove ${member.name}`}><X className="h-4 w-4" /></button>}</div>)}</div></section></div>}

      {showSettings && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSettings(false)}><section className="hearth-modal messenger-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-5"><div><p className="modal-kicker">This device</p><h2 id="settings-title">Privacy & relay</h2></div><button type="button" onClick={() => setShowSettings(false)} className="modal-close" aria-label="Close"><X className="h-4 w-4" /></button></div><div className="settings-identity"><span className="person-avatar person-avatar--self">{initials(visibleMembers.find((member) => member.pubkey === identity.pubkey)?.name ?? "You")}</span><div className="min-w-0 flex-1"><strong>{visibleMembers.find((member) => member.pubkey === identity.pubkey)?.name ?? "You"}</strong><small>{displayNpub(identity.pubkey)}</small></div></div><div className="auto-enrollment-note"><ShieldCheck className="h-4 w-4" /><span>This device is an authorized member of {familyName}. The server verifies family access before relay delivery.</span></div><label className="modal-label">Family relay<Input value={settingsRelayUrl} onChange={(event) => setSettingsRelayUrl(event.target.value)} /></label><div className="relay-status"><CircleAlert className="h-4 w-4" />{connectionNote || relayUrl}</div><Button onClick={onUpdateRelay} className="hearth-primary mt-5 w-full"><Link2 className="mr-2 h-4 w-4" />Save and reconnect</Button><button type="button" onClick={onForgetDevice} className="forget-link"><LogOut className="h-3.5 w-3.5" />Forget this device</button><p className="settings-footnote"><ShieldCheck className="h-3.5 w-3.5" />Your private key remains in this browser.</p></section></div>}
    </main>
  );
}
