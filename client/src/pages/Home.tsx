/**
 * Hearth Ledger design reminder: warm editorial domesticity, a ledger-spread layout,
 * porcelain paper surfaces, and Hearth Red for only decisive connection and send moments.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  DoorOpen,
  KeyRound,
  Link2,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Radio,
  Send,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import type { Relay } from "nostr-tools";
import type { Subscription } from "nostr-tools/abstract-relay";
import {
  buildRelay,
  displayNpub,
  FAMILY_SUBJECT,
  generateIdentity,
  getStoredIdentity,
  getStoredMembers,
  getStoredRelay,
  identityFromSecret,
  isFamilyRoomMessage,
  normalizeRelayUrl,
  parsePublicKey,
  publishFamilyMessage,
  shortKey,
  storeIdentity,
  storeMembers,
  storeRelay,
  unwrapFamilyMessage,
  type FamilyMember,
  type FamilyMessage,
  type LocalIdentity,
} from "@/lib/nostr";

const sealUrl = "/manus-storage/hearthline-seal_f89e7d2b.png";
const roomArtworkUrl = "/manus-storage/hearthline-warm-room_0cc1ba24.jpg";
const relayArtworkUrl = "/manus-storage/hearthline-relay-card_c0f5c472.jpg";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

function formatMessageTime(seconds: number) {
  const date = new Date(seconds * 1000);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function ConnectionDot({ state }: { state: ConnectionState }) {
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${
        state === "connected"
          ? "bg-[#65806D]"
          : state === "error"
            ? "bg-[#A83D32]"
            : "bg-[#D9CCBA]"
      }`}
      aria-hidden="true"
    />
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const [identity, setIdentity] = useState<LocalIdentity | null>(() => getStoredIdentity());
  const [members, setMembers] = useState<FamilyMember[]>(() => getStoredMembers());
  const [relayUrl, setRelayUrl] = useState(() => getStoredRelay());
  const [settingsRelayUrl, setSettingsRelayUrl] = useState(() => getStoredRelay());
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [connectionNote, setConnectionNote] = useState("Not connected");
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showMobileRail, setShowMobileRail] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberKey, setMemberKey] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupRelay, setSetupRelay] = useState("");
  const [importSecret, setImportSecret] = useState("");
  const [showImport, setShowImport] = useState(false);
  const relayRef = useRef<Relay | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const allowedKeysRef = useRef<string[]>([]);

  const selfMember = useMemo<FamilyMember | null>(() => {
    if (!identity) return null;
    const stored = members.find((member) => member.pubkey === identity.pubkey);
    return stored ?? { id: "me", name: "You", pubkey: identity.pubkey };
  }, [identity, members]);

  const visibleMembers = useMemo(() => {
    if (!selfMember) return members;
    return [selfMember, ...members.filter((member) => member.pubkey !== selfMember.pubkey)];
  }, [members, selfMember]);

  const allowedKeys = useMemo(() => visibleMembers.map((member) => member.pubkey), [visibleMembers]);
  allowedKeysRef.current = allowedKeys;

  const memberByKey = useMemo(
    () => new Map(visibleMembers.map((member) => [member.pubkey, member])),
    [visibleMembers],
  );

  const addMessage = (message: FamilyMessage) => {
    setMessages((current) => {
      if (current.some((existing) => existing.id === message.id)) return current;
      return [...current, message].sort((a, b) => a.createdAt - b.createdAt);
    });
  };

  const disconnect = () => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
    relayRef.current?.close();
    relayRef.current = null;
    setConnection("idle");
    setConnectionNote("Not connected");
  };

  const connect = async (requestedRelay = relayUrl, requestedIdentity = identity) => {
    if (!requestedIdentity) return;
    let normalizedRelay: string;
    try {
      normalizedRelay = normalizeRelayUrl(requestedRelay);
    } catch (error) {
      setConnection("error");
      setConnectionNote(error instanceof Error ? error.message : "Enter a valid relay address.");
      return;
    }
    disconnect();
    setConnection("connecting");
    setConnectionNote("Opening your household relay…");
    try {
      const relay = buildRelay(normalizedRelay, requestedIdentity);
      relay.onnotice = (notice) => setConnectionNote(notice || "Relay sent a notice.");
      relay.onclose = () => {
        setConnection("error");
        setConnectionNote("Relay connection closed.");
      };
      await relay.connect();
      relayRef.current = relay;
      setRelayUrl(normalizedRelay);
      setSettingsRelayUrl(normalizedRelay);
      storeRelay(normalizedRelay);
      setConnection("connected");
      setConnectionNote("Private relay connected");
      subscriptionRef.current = relay.subscribe(
        [{ kinds: [1059], "#p": [requestedIdentity.pubkey], limit: 200 }],
        {
          onevent: (event) => {
            const message = unwrapFamilyMessage(event, requestedIdentity);
            if (message && isFamilyRoomMessage(message, allowedKeysRef.current)) addMessage(message);
          },
          onclose: (reason) => {
            if (reason) setConnectionNote(reason);
          },
        },
      );
    } catch (error) {
      setConnection("error");
      setConnectionNote(error instanceof Error ? error.message : "Unable to reach the relay.");
    }
  };

  useEffect(() => {
    if (identity && relayUrl) void connect(relayUrl, identity);
    return () => disconnect();
    // The connection lifecycle is manually coordinated by explicit relay and identity actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMembers = (nextMembers: FamilyMember[]) => {
    setMembers(nextMembers);
    storeMembers(nextMembers);
  };

  const completeSetup = async () => {
    try {
      const nextIdentity = generateIdentity();
      const normalizedRelay = normalizeRelayUrl(setupRelay);
      const me: FamilyMember = {
        id: crypto.randomUUID(),
        name: setupName.trim() || "You",
        pubkey: nextIdentity.pubkey,
      };
      storeIdentity(nextIdentity);
      storeMembers([me]);
      storeRelay(normalizedRelay);
      setIdentity(nextIdentity);
      setMembers([me]);
      setRelayUrl(normalizedRelay);
      setSettingsRelayUrl(normalizedRelay);
      await connect(normalizedRelay, nextIdentity);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Complete the relay address to continue.");
    }
  };

  const importIdentity = async () => {
    try {
      const nextIdentity = identityFromSecret(importSecret);
      const normalizedRelay = normalizeRelayUrl(setupRelay);
      const me: FamilyMember = {
        id: crypto.randomUUID(),
        name: setupName.trim() || "You",
        pubkey: nextIdentity.pubkey,
      };
      storeIdentity(nextIdentity);
      storeMembers([me]);
      storeRelay(normalizedRelay);
      setIdentity(nextIdentity);
      setMembers([me]);
      setRelayUrl(normalizedRelay);
      setSettingsRelayUrl(normalizedRelay);
      setImportSecret("");
      await connect(normalizedRelay, nextIdentity);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import that key.");
    }
  };

  const addMember = () => {
    try {
      const pubkey = parsePublicKey(memberKey);
      if (!memberName.trim()) throw new Error("Give this family member a name.");
      if (members.some((member) => member.pubkey === pubkey)) throw new Error("That family member is already here.");
      const nextMember: FamilyMember = { id: crypto.randomUUID(), name: memberName.trim(), pubkey };
      saveMembers([...members, nextMember]);
      setMemberName("");
      setMemberKey("");
      toast.success(`${nextMember.name} was added to this device.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Check the member details.");
    }
  };

  const removeMember = (pubkey: string) => {
    saveMembers(members.filter((member) => member.pubkey !== pubkey));
  };

  const updateRelay = async () => {
    try {
      const normalized = normalizeRelayUrl(settingsRelayUrl);
      setShowSettings(false);
      await connect(normalized, identity);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Check the relay address.");
    }
  };

  const copyPublicKey = async () => {
    if (!identity) return;
    await navigator.clipboard.writeText(displayNpub(identity.pubkey));
    toast.success("Your npub is ready to share with the family organizer.");
  };

  const sendMessage = async () => {
    if (!identity || !relayRef.current || !draft.trim()) return;
    setIsSending(true);
    try {
      await publishFamilyMessage(
        relayRef.current,
        identity,
        members.map((member) => member.pubkey),
        draft,
      );
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The message could not be delivered.");
    } finally {
      setIsSending(false);
    }
  };

  const forgetDevice = () => {
    disconnect();
    localStorage.removeItem("hearthline.identity.v1");
    localStorage.removeItem("hearthline.members.v1");
    localStorage.removeItem("hearthline.settings.v1");
    setIdentity(null);
    setMembers([]);
    setRelayUrl("");
    setMessages([]);
    setShowSettings(false);
  };

  if (!identity) {
    return (
      <main className="setup-page min-h-screen text-[#302C28]">
        <section className="setup-grid min-h-screen">
          <div className="relative flex min-h-[54vh] flex-col justify-between overflow-hidden bg-[#2F2E2A] px-6 py-7 text-[#F7F2E9] sm:px-10 sm:py-10 lg:min-h-screen lg:px-14 lg:py-12">
            <img
              src={roomArtworkUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(54,45,38,.82),rgba(92,54,43,.5)_57%,rgba(47,46,42,.28))]" />
            <div className="setup-paper-noise" />
            <div className="relative flex items-center gap-3">
              <img src={sealUrl} alt="Hearthline" className="h-11 w-11 rounded-full bg-[#F7F2E9] p-1.5" />
              <div className="flex flex-col leading-none">
                <span className="font-['Fraunces'] text-[1.42rem] font-semibold tracking-[-.045em] text-[#FFF9F2]">Hearthline</span>
                <span className="mt-1.5 font-['DM_Sans'] text-[.55rem] font-bold tracking-[.17em] text-[#E7C3A5] uppercase">Family correspondence</span>
              </div>
            </div>
            <div className="relative max-w-xl py-10 lg:pb-20">
              <p className="mb-5 font-['DM_Sans'] text-xs font-bold tracking-[0.18em] text-[#E3AA78] uppercase">Private family correspondence</p>
              <h1 className="font-['Fraunces'] text-5xl leading-[.97] tracking-[-0.045em] sm:text-6xl lg:text-7xl">A room for the people you keep close.</h1>
              <p className="mt-7 max-w-md font-['DM_Sans'] text-base leading-7 text-[#E7DDD0]">Hearthline sends signed, encrypted Nostr messages through the relay your family runs.</p>
            </div>
            <div className="relative flex items-center gap-3 border-l-2 border-[#D98C75] pl-3 font-['DM_Sans'] text-xs text-[#E7D4C1]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#F1B185]" />
              <span><strong className="font-semibold text-[#FFF4E8]">Quietly yours.</strong> Your key stays on this device.</span>
            </div>
          </div>

          <div className="relative flex items-center overflow-hidden bg-[#F7F2E9] px-6 py-12 sm:px-10 lg:px-16 lg:py-16">
            <div className="setup-binding" aria-hidden="true"><span /><span /><span /></div>
            <div className="setup-ledger mx-auto w-full max-w-md">
              <div className="mb-10">
                <p className="eyebrow">Bring your key, or make one</p>
                <h2 className="mt-3 font-['Fraunces'] text-4xl tracking-[-0.04em] text-[#302C28]">Open the family room</h2>
                <p className="mt-3 font-['DM_Sans'] text-sm leading-6 text-[#726A61]">Start by naming this device and adding the secure relay address from your deployment.</p>
              </div>

              <div className="ledger-form space-y-5">
                <div className="ledger-section-label"><span>01</span><p>Identity for this device</p></div>
                <label className="field-label">
                  <span>Your name on this device</span>
                  <Input value={setupName} onChange={(event) => setSetupName(event.target.value)} placeholder="For example, Alice" className="hearth-input mt-2" />
                </label>
                <div className="ledger-section-label pt-1"><span>02</span><p>The household relay</p></div>
                <label className="field-label">
                  <span>Family relay address</span>
                  <Input value={setupRelay} onChange={(event) => setSetupRelay(event.target.value)} placeholder="wss://relay.example.com" className="hearth-input mt-2" />
                </label>
              </div>

              {showImport ? (
                <div className="mt-5 rounded-2xl border border-[#D8CCBD] bg-[#FFFDF8] p-4">
                  <label className="field-label">
                    <span>Import an nsec or hex secret</span>
                    <Textarea value={importSecret} onChange={(event) => setImportSecret(event.target.value)} placeholder="nsec1…" className="hearth-input mt-2 min-h-24 resize-none font-mono text-xs" />
                  </label>
                  <Button onClick={() => void importIdentity()} className="hearth-primary mt-4 w-full">Import this identity</Button>
                </div>
              ) : (
                <Button onClick={() => void completeSetup()} className="hearth-primary mt-7 w-full">Set a key at this place <ArrowUp className="ml-2 h-4 w-4" /></Button>
              )}
              <button type="button" onClick={() => setShowImport((current) => !current)} className="mt-5 flex w-full items-center justify-center gap-2 font-['DM_Sans'] text-xs font-bold text-[#8C4D42] underline-offset-4 hover:underline">
                <KeyRound className="h-3.5 w-3.5" />
                {showImport ? "Use a new device key instead" : "I already have a family key"}
              </button>
              <div className="trust-marginalia mt-8">
                <div><ShieldCheck className="h-4 w-4" /><p><strong>Your key stays here.</strong> It signs and opens messages on this device.</p></div>
                <div><Radio className="h-4 w-4" /><p><strong>The relay is family-run.</strong> It carries sealed correspondence, not a social feed.</p></div>
                <div><UsersRound className="h-4 w-4" /><p><strong>Joining is deliberate.</strong> The organizer adds your public identity before you enter.</p></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="h-screen min-h-[600px] overflow-hidden bg-[#F7F2E9] text-[#302C28]">
      <div className="ledger-layout h-full">
        <aside className={`family-rail ${showMobileRail ? "family-rail--open" : ""}`} aria-label="Family members">
          <div className="flex items-center justify-between px-5 pt-6 lg:px-6">
            <div className="flex items-center gap-2.5">
              <img src={sealUrl} alt="Hearthline" className="h-9 w-9 rounded-full bg-[#E9DED0] p-1" />
              <span className="font-['DM_Sans'] text-[11px] font-extrabold tracking-[0.16em] text-[#504B45] uppercase">Hearthline</span>
            </div>
            <button type="button" onClick={() => setShowMobileRail(false)} className="lg:hidden" aria-label="Close family rail"><X className="h-5 w-5" /></button>
          </div>

          <div className="mx-5 mt-8 rounded-[1.35rem] bg-[#EAE0D4] p-3 lg:mx-6">
            <div className="flex items-center gap-2 rounded-xl bg-[#A83D32] px-3 py-3 text-[#FFF9F2] shadow-[0_8px_16px_rgba(125,48,39,.18)]">
              <DoorOpen className="h-4 w-4" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-['DM_Sans'] text-xs font-bold">Family room</p>
                <p className="font-['DM_Sans'] text-[10px] opacity-75">Shared correspondence</p>
              </div>
            </div>
          </div>

          <div className="mt-8 px-5 lg:px-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">At the table</p>
              <button type="button" onClick={() => setShowMembers(true)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8C4D42] hover:bg-[#ECE2D7]" aria-label="Add a family member"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5">
              {visibleMembers.map((member) => {
                const isSelf = member.pubkey === identity.pubkey;
                return (
                  <div key={member.pubkey} className="member-row">
                    <span className={`member-avatar ${isSelf ? "member-avatar--self" : ""}`}>{initials(member.name)}</span>
                    <span className="min-w-0 flex-1 truncate font-['DM_Sans'] text-sm font-medium">{member.name}</span>
                    {isSelf && <span className="font-['DM_Sans'] text-[10px] font-bold tracking-[.08em] text-[#9A6259] uppercase">you</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-[#DDD2C5] px-5 py-5 lg:px-6">
            <button type="button" onClick={() => setShowSettings(true)} className="flex w-full items-center gap-3 rounded-xl py-2 text-left transition-colors hover:bg-[#EFE6DB]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DFD2C3] font-['DM_Sans'] text-[11px] font-bold text-[#735B4D]">{initials(selfMember?.name ?? "You")}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-['DM_Sans'] text-sm font-semibold">{selfMember?.name}</span>
                <span className="block truncate font-mono text-[10px] text-[#8B8177]">{shortKey(identity.pubkey)}</span>
              </span>
              <Settings2 className="h-4 w-4 text-[#8B8177]" />
            </button>
          </div>
        </aside>

        <section className="conversation-pane relative flex h-full min-w-0 flex-col bg-[#FFFCF6]">
          <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#E5D9CD] px-5 sm:px-7 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setShowMobileRail(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3D8CA] lg:hidden" aria-label="Open family rail"><Menu className="h-4 w-4" /></button>
              <div className="min-w-0">
                <p className="eyebrow mb-1">The household</p>
                <h1 className="truncate font-['Fraunces'] text-2xl tracking-[-0.035em]">Family room</h1>
              </div>
            </div>
            <button type="button" onClick={() => setShowSettings(true)} className="connection-pill" title={connectionNote}>
              <ConnectionDot state={connection} />
              <span className="hidden sm:inline">{connection === "connected" ? "Relay live" : connection === "connecting" ? "Connecting" : "Relay offline"}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-8 sm:px-7 lg:px-10 lg:pt-10">
            <div className="mx-auto max-w-3xl">
              <div className="thread-intro mb-10">
                <div className="thread-line" />
                <p className="eyebrow bg-[#FFFCF6] px-3">{FAMILY_SUBJECT}</p>
                <div className="thread-line" />
              </div>
              {messages.length === 0 ? (
                <div className="empty-room">
                  <img src={roomArtworkUrl} alt="Quiet household room" className="empty-room-art" />
                  <div className="empty-room-wash" />
                  <div className="relative max-w-sm px-7 py-8 sm:px-10 sm:py-10">
                    <p className="eyebrow text-[#AA6152]">A fresh page</p>
                    <h2 className="mt-3 font-['Fraunces'] text-3xl tracking-[-.035em] text-[#3A332D]">The room is waiting for its first note.</h2>
                    <p className="mt-3 font-['DM_Sans'] text-sm leading-6 text-[#655B51]">Once each person has been added to the relay allowlist and this room, messages arrive here as signed, encrypted correspondence.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-7 pb-2">
                  {messages.map((message) => {
                    const author = memberByKey.get(message.author);
                    const isSelf = message.author === identity.pubkey;
                    return (
                      <article key={message.id} className={`message-entry ${isSelf ? "message-entry--self" : ""}`}>
                        <span className={`member-avatar shrink-0 ${isSelf ? "member-avatar--self" : ""}`}>{initials(author?.name ?? shortKey(message.author, 2))}</span>
                        <div className="min-w-0">
                          <div className="mb-1.5 flex items-baseline gap-2">
                            <h3 className="font-['DM_Sans'] text-sm font-bold">{isSelf ? "You" : author?.name ?? shortKey(message.author)}</h3>
                            <time className="font-['DM_Sans'] text-[11px] text-[#9B9086]">{formatMessageTime(message.createdAt)}</time>
                          </div>
                          <p className="message-bubble">{message.content}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 bg-gradient-to-t from-[#FFFCF6] via-[#FFFCF6] pt-3 sm:px-7 lg:px-10">
            <div className={`composer-shell ${isComposerFocused ? "composer-shell--focus" : ""}`}>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onFocus={() => setIsComposerFocused(true)}
                onBlur={() => setIsComposerFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={connection !== "connected" || members.length < 2}
                placeholder={members.length < 2 ? "Add a family member to begin…" : connection === "connected" ? "Write to the family…" : "Reconnect to the relay to write…"}
                className="min-h-[64px] resize-none border-0 bg-transparent px-4 py-3.5 font-['DM_Sans'] text-sm shadow-none focus-visible:ring-0"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <span className="font-['DM_Sans'] text-[10px] text-[#9C9186]">Enter to send · Shift + Enter for a new line</span>
                <Button onClick={() => void sendMessage()} disabled={!draft.trim() || isSending || connection !== "connected" || members.length < 2} className="send-button" aria-label="Send message">
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="status-rail hidden h-full overflow-y-auto border-l border-[#E3D8CA] bg-[#F7F2E9] px-6 py-7 xl:block">
          <p className="eyebrow">Relay note</p>
          <div className="mt-4 overflow-hidden rounded-2xl bg-[#EAE1D5]">
            <img src={relayArtworkUrl} alt="Signal lantern for the family relay" className="h-32 w-full object-cover" />
            <div className="p-4">
              <div className="flex items-center gap-2"><ConnectionDot state={connection} /><p className="font-['DM_Sans'] text-xs font-bold text-[#4E4943]">{connection === "connected" ? "House relay is present" : connection === "connecting" ? "Calling the relay" : "Relay needs attention"}</p></div>
              <p className="mt-2 break-all font-mono text-[10px] leading-4 text-[#7A7168]">{relayUrl || "No relay selected"}</p>
            </div>
          </div>
          <div className="mt-8 space-y-5">
            <div className="margin-note"><Radio className="h-4 w-4 text-[#8E625A]" /><div><p>One private path</p><span>Messages are sent to this relay only.</span></div></div>
            <div className="margin-note"><KeyRound className="h-4 w-4 text-[#8E625A]" /><div><p>Key stays here</p><span>This device signs and decrypts locally.</span></div></div>
            <div className="margin-note"><UsersRound className="h-4 w-4 text-[#8E625A]" /><div><p>{Math.max(visibleMembers.length - 1, 0)} relatives joined</p><span>Each key must also be allowed by the relay.</span></div></div>
          </div>
          <button type="button" onClick={() => setShowSettings(true)} className="mt-8 inline-flex items-center gap-2 font-['DM_Sans'] text-xs font-bold text-[#8C4D42] underline-offset-4 hover:underline">Open relay settings <ArrowUp className="h-3.5 w-3.5" /></button>
        </aside>
      </div>

      {showMembers && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowMembers(false)}>
          <section className="hearth-modal" role="dialog" aria-modal="true" aria-labelledby="members-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-5"><div><p className="eyebrow">Family directory</p><h2 id="members-title" className="mt-2 font-['Fraunces'] text-3xl tracking-[-.04em]">Set the table</h2></div><button type="button" onClick={() => setShowMembers(false)} className="modal-close" aria-label="Close"><X className="h-4 w-4" /></button></div>
            <p className="mt-3 font-['DM_Sans'] text-sm leading-6 text-[#746A61]">Add the public key (npub or hex) for everyone who belongs in this room. The relay administrator must add the same key to the deployment allowlist.</p>
            <div className="mt-6 space-y-4"><label className="field-label"><span>Name</span><Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="For example, Theo" className="hearth-input mt-2" /></label><label className="field-label"><span>Public key or npub</span><Input value={memberKey} onChange={(event) => setMemberKey(event.target.value)} placeholder="npub1…" className="hearth-input mt-2 font-mono text-xs" /></label><Button onClick={addMember} className="hearth-primary w-full"><Plus className="mr-2 h-4 w-4" />Add to this device</Button></div>
            <div className="mt-7 border-t border-[#E0D5C7] pt-4"><p className="eyebrow mb-3">In this room</p><div className="max-h-40 space-y-2 overflow-y-auto pr-1">{visibleMembers.map((member) => <div key={member.pubkey} className="flex items-center gap-3 rounded-xl bg-[#F8F2E9] px-3 py-2.5"><span className="member-avatar">{initials(member.name)}</span><span className="min-w-0 flex-1 truncate font-['DM_Sans'] text-sm font-semibold">{member.name}</span>{member.pubkey !== identity.pubkey && <button type="button" onClick={() => removeMember(member.pubkey)} className="text-[#A83D32]" aria-label={`Remove ${member.name}`}><X className="h-4 w-4" /></button>}</div>)}</div></div>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSettings(false)}>
          <section className="hearth-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-5"><div><p className="eyebrow">This device</p><h2 id="settings-title" className="mt-2 font-['Fraunces'] text-3xl tracking-[-.04em]">Relay & identity</h2></div><button type="button" onClick={() => setShowSettings(false)} className="modal-close" aria-label="Close"><X className="h-4 w-4" /></button></div>
            <div className="mt-6 rounded-2xl border border-[#E1D5C7] bg-[#FFFDF8] p-4"><div className="flex items-center gap-3"><span className="member-avatar member-avatar--self">{initials(selfMember?.name ?? "You")}</span><div className="min-w-0"><p className="font-['DM_Sans'] text-sm font-bold">{selfMember?.name}</p><p className="truncate font-mono text-[10px] text-[#81776E]">{displayNpub(identity.pubkey)}</p></div></div><Button variant="outline" onClick={() => void copyPublicKey()} className="mt-4 h-9 w-full rounded-xl border-[#D8C7B8] bg-transparent font-['DM_Sans'] text-xs text-[#7F4F44]"><Copy className="mr-2 h-3.5 w-3.5" />Copy public identity</Button></div>
            <label className="field-label mt-6"><span>Family relay</span><Input value={settingsRelayUrl} onChange={(event) => setSettingsRelayUrl(event.target.value)} className="hearth-input mt-2" /></label>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#F2E6D9] p-3 font-['DM_Sans'] text-xs leading-5 text-[#755C4E]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{connectionNote}</div>
            <Button onClick={() => void updateRelay()} className="hearth-primary mt-5 w-full"><Link2 className="mr-2 h-4 w-4" />Save and reconnect</Button>
            <button type="button" onClick={forgetDevice} className="mt-6 flex w-full items-center justify-center gap-2 font-['DM_Sans'] text-xs font-bold text-[#A83D32] underline-offset-4 hover:underline"><LogOut className="h-3.5 w-3.5" />Forget this device</button>
            <p className="mt-3 text-center font-['DM_Sans'] text-[10px] leading-4 text-[#91877C]">Forgetting removes the local key from this browser only; it cannot erase copies of messages already stored by the relay.</p>
          </section>
        </div>
      )}
    </main>
  );
}
