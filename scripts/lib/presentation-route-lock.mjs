import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { personalIpIntentForBrief } from "./visual-route-planner.mjs";

const SEMANTIC_LAYER_VALUE_RE = /semantic[-_ ]?layers?|layered[-_ ]?svg|svg[-_ ]?html|语义分层|分层输出/i;
const PERSONAL_IP_ANIMATION_TEXT_RE = /个人\s*IP[\s+＋加与和结合配合带]*?(?:分层|手绘|路径|交互|语义)?\s*(?:动画|动效)|(?:动画|动效)[\s+＋加与和结合配合带]*?个人\s*IP|personal\s+IP\s*(?:\+|plus|with)?\s*(?:animation|motion)|personal\s+IP\s+animation/i;

function readJsonIfExists(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function authorizationCandidate(brief = {}) {
  return brief.personalIpAnimationAuthorization
    || brief.presentationRouteAuthorization?.personalIpAnimation
    || brief.userIntent?.personalIpAnimationAuthorization
    || null;
}

function routeChangeAuthorizationCandidate(brief = {}) {
  return brief.presentationRouteChangeAuthorization
    || brief.presentationRouteAuthorization?.routeChange
    || brief.userIntent?.presentationRouteChangeAuthorization
    || null;
}

function requestedSemanticLayerRoute(brief = {}, personalIpIntent = personalIpIntentForBrief(brief)) {
  if (!personalIpIntent.active) return false;
  const personalIp = brief.personalIp && typeof brief.personalIp === "object" ? brief.personalIp : {};
  const ipDiagram = brief.ipDiagramCreator && typeof brief.ipDiagramCreator === "object" ? brief.ipDiagramCreator : {};
  const explicitValues = [
    brief.personalIpAnimation,
    brief.addHandDrawnImageAnimation,
    brief.handDrawnImageAnimation,
    personalIp.animation,
    personalIp.motion,
    personalIp.addHandDrawnImageAnimation,
    ipDiagram.addHandDrawnImageAnimation,
  ].filter((value) => value !== undefined && value !== null && value !== "");
  if (explicitValues.some((value) => SEMANTIC_LAYER_VALUE_RE.test(String(value)))) return true;
  const text = [
    brief.visualMode,
    brief.title,
    brief.objective,
    brief.notes,
    brief.visualStyle,
    brief.motionStyle,
  ].filter(Boolean).join(" ");
  const withoutNegatedAnimation = text.replace(/(?:不要|无需|不需要|不做|不用|别做|取消|关闭|禁用|没有|无)\s*(?:个人\s*IP\s*)?(?:分层|手绘|路径|交互|语义)?\s*(?:动画|动效)/gi, " ");
  return PERSONAL_IP_ANIMATION_TEXT_RE.test(withoutNegatedAnimation);
}

function validateSemanticAuthorization(brief = {}, requested = false) {
  const authorization = authorizationCandidate(brief);
  if (!requested) {
    return {
      required: false,
      pass: true,
      authorization: authorization || null,
      reason: "semantic personal-IP animation was not requested",
    };
  }
  const source = String(authorization?.source || authorization?.userRequest || authorization?.sourceText || "").trim();
  const mode = String(authorization?.mode || authorization?.requestedMode || "").trim();
  const pass = authorization?.authorizedByUser === true
    && SEMANTIC_LAYER_VALUE_RE.test(mode)
    && PERSONAL_IP_ANIMATION_TEXT_RE.test(source);
  return {
    required: true,
    pass,
    authorization: authorization || null,
    sourceSha256: source ? sha256(source) : null,
    reason: pass
      ? "literal user request authorizes personal-IP semantic animation"
      : "personal-IP semantic animation requires authorizedByUser:true, mode semantic-layers, and a literal user-request source that explicitly says personal IP plus animation",
  };
}

function validateRouteChangeAuthorization(brief = {}, previousRouteId = "", nextRouteId = "") {
  if (!previousRouteId || previousRouteId === nextRouteId) {
    return { required: false, pass: true, authorization: null, reason: "route unchanged" };
  }
  const authorization = routeChangeAuthorizationCandidate(brief);
  const source = String(authorization?.source || authorization?.userRequest || "").trim();
  const pass = authorization?.authorizedByUser === true
    && authorization?.fromRoute === previousRouteId
    && authorization?.toRoute === nextRouteId
    && source.length > 0;
  return {
    required: true,
    pass,
    authorization: authorization || null,
    sourceSha256: source ? sha256(source) : null,
    reason: pass
      ? "literal user-authorized route change matches the locked route transition"
      : "an existing project route cannot change without matching user-authorized fromRoute/toRoute evidence",
  };
}

export function buildPresentationRouteLock({ brief = {}, previous = null } = {}) {
  const personalIpIntent = personalIpIntentForBrief(brief);
  const semanticRequested = requestedSemanticLayerRoute(brief, personalIpIntent);
  const requestedRouteId = personalIpIntent.active
    ? semanticRequested
      ? "personal-ip-semantic-layers-svg-html-video"
      : "personal-ip-native-final-pages"
    : "non-personal-ip-planner-route";
  const semanticAuthorization = validateSemanticAuthorization(brief, semanticRequested);
  const routeChangeAuthorization = validateRouteChangeAuthorization(
    brief,
    previous?.resolvedRouteId || "",
    requestedRouteId,
  );
  const pass = semanticAuthorization.pass && routeChangeAuthorization.pass;
  const violations = [
    ...(!semanticAuthorization.pass ? ["personal-ip-semantic-route-not-user-authorized"] : []),
    ...(!routeChangeAuthorization.pass ? ["presentation-route-change-not-user-authorized"] : []),
  ];
  return {
    schemaVersion: 1,
    stage: "pre-planning-presentation-route-lock",
    status: pass ? "locked" : "blocked",
    pass,
    personalIpIntent,
    requestedRouteId,
    resolvedRouteId: pass ? requestedRouteId : previous?.resolvedRouteId || null,
    immutableForProject: true,
    semanticAnimationRequested: semanticRequested,
    semanticAnimationAuthorization: semanticAuthorization,
    routeChangeAuthorization,
    previousRouteId: previous?.resolvedRouteId || null,
    violations,
    policy: {
      plainPersonalIpAlwaysUsesNativePages: true,
      videoOrTalkingHeadDoesNotImplyAnimation: true,
      semanticAnimationRequiresLiteralUserAuthorization: true,
      agentAuthoredBriefFieldsCannotAuthorizeRouteEscalation: true,
      retriesCannotChangeLockedRouteWithoutUserAuthorization: true,
    },
  };
}

export function enforcePresentationRouteLock({ brief = {}, out }) {
  const path = join(out, "workflow", "presentation-route-lock.json");
  const previous = existsSync(path) ? readJsonIfExists(path) : null;
  const contract = buildPresentationRouteLock({ brief, previous });
  writeJson(path, contract);
  if (!contract.pass) {
    const error = new Error(`Presentation route lock blocked: ${contract.violations.join(", ")}. See workflow/presentation-route-lock.json.`);
    error.code = contract.violations[0] || "presentation-route-lock-failed";
    error.contract = contract;
    throw error;
  }
  return contract;
}
