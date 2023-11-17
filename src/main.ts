import fetch from "cross-fetch";
import { isForNode } from "is-bundling-for-browser-or-node";

import { version } from "../package.json";

import type { FeedbackPosition, FeedbackTranslations } from "./feedback/types";
import { SSE_REALTIME_HOST, TRACKING_HOST } from "./config";
import { createDefaultFeedbackPromptHandler } from "./default-feedback-prompt-handler";
import * as feedbackLib from "./feedback";
import {
  FeedbackPromptCompletionHandler,
  parsePromptMessage,
  processPromptMessage,
} from "./prompts";
import { AblySSEChannel, closeAblySSEChannel, openAblySSEChannel } from "./sse";
import type {
  Company,
  Context,
  Feedback,
  FeedbackPrompt,
  FeedbackPromptHandler,
  FeedbackPromptHandlerCallbacks,
  FeedbackPromptReplyHandler,
  Key,
  Options,
  RequestFeedbackOptions,
  TrackedEvent,
  User,
} from "./types";

async function request(url: string, body: any) {
  return fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Bucket-Sdk-Version": version,
    },
    body: JSON.stringify(body),
  });
}

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

export default function main() {
  let debug = false;
  let trackingKey: string | undefined = undefined;
  let trackingHost: string = TRACKING_HOST;
  let sseHost: string = SSE_REALTIME_HOST;
  let sessionUserId: string | undefined = undefined;
  let persistUser: boolean = !isForNode;
  let liveSatisfactionActive: boolean = false;
  let sseChannel: AblySSEChannel | undefined = undefined;
  let liveSatisfactionEnabled: boolean = !isForNode;
  let feedbackPromptHandler: FeedbackPromptHandler | undefined = undefined;
  let feedbackPromptingUserId: string | undefined = undefined;
  let feedbackPosition: FeedbackPosition | undefined = undefined;
  let feedbackTranslations: Partial<FeedbackTranslations> | undefined =
    undefined;

  log("Instance created");

  function getUrl() {
    return `${trackingHost}/${trackingKey}`;
  }
  function checkKey() {
    if (!trackingKey) {
      err("Tracking key is not set, please call init() first");
    }
  }
  function getSessionUser() {
    if (!sessionUserId) {
      err(
        "User is not set, please call user() first or provide userId as argument",
      );
    }
    return sessionUserId;
  }

  function log(message: string, ...args: any[]) {
    if (debug) {
      console.log("[Bucket]", message, ...args);
    }
  }

  function warn(message: string, ...args: any[]) {
    console.warn("[Bucket]", message, ...args);
  }

  function err(message: string, ...args: any[]): never {
    if (debug) {
      console.error("[Bucket]", message, ...args);
    }
    throw new Error(message);
  }

  function resolveUser(userId?: User["userId"]): string | never {
    if (persistUser) {
      return getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }

    return userId!;
  }

  function init(key: Key, options: Options = {}) {
    reset();
    if (!key) {
      err("Tracking key was not provided");
    }

    trackingKey = key;

    if (options.debug) debug = options.debug;
    if (options.host) trackingHost = options.host;
    if (options.sseHost) sseHost = options.sseHost;

    if (options.feedback?.ui?.position) {
      feedbackPosition = options.feedback?.ui?.position;
    }

    if (options.feedback?.ui?.translations) {
      feedbackTranslations = options.feedback?.ui?.translations;
    }

    if (typeof options.persistUser !== "undefined") {
      persistUser = options.persistUser;
    }

    if (typeof options.feedback?.enableLiveFeedback !== "undefined") {
      liveSatisfactionEnabled = options.feedback.enableLiveFeedback;
    }

    if (typeof options.feedback?.enableLiveSatisfaction !== "undefined") {
      liveSatisfactionEnabled = options.feedback.enableLiveSatisfaction;
    }

    if (liveSatisfactionEnabled && isForNode) {
      err("Feedback prompting is not supported in Node.js environment");
    }

    if (liveSatisfactionEnabled && !persistUser) {
      err("Feedback prompting is not supported when persistUser is disabled");
    }

    feedbackPromptHandler =
      options.feedback?.liveFeedbackHandler ??
      options.feedback?.liveSatisfactionHandler ??
      createDefaultFeedbackPromptHandler(options.feedback?.ui);

    log(`initialized with key "${trackingKey}" and options`, options);
  }

  async function user(
    userId: User["userId"],
    attributes?: User["attributes"],
    context?: Context,
  ) {
    checkKey();
    if (!userId) err("No userId provided");
    if (persistUser) {
      if (sessionUserId && sessionUserId !== userId) {
        reset();
      }
      sessionUserId = userId;
      if (liveSatisfactionEnabled && !liveSatisfactionActive) {
        await initLiveSatisfaction(userId);
      }
    }
    const payload: User = {
      userId,
      attributes,
      context,
    };
    const res = await request(`${getUrl()}/user`, payload);
    log(`sent user`, res);
    return res;
  }

  async function company(
    companyId: Company["companyId"],
    attributes?: Company["attributes"] | null,
    userId?: Company["userId"],
    context?: Context,
  ) {
    checkKey();
    if (!companyId) err("No companyId provided");
    userId = resolveUser(userId);

    const payload: Company = {
      userId,
      companyId,
      context,
    };
    if (attributes) payload.attributes = attributes;
    const res = await request(`${getUrl()}/company`, payload);
    log(`sent company`, res);
    return res;
  }

  async function track(
    eventName: TrackedEvent["event"],
    attributes?: TrackedEvent["attributes"] | null,
    userId?: Company["userId"],
    companyId?: Company["companyId"],
    context?: Context,
  ) {
    checkKey();
    if (!eventName) err("No eventName provided");
    userId = resolveUser(userId);

    const payload: TrackedEvent = {
      userId,
      event: eventName,
      companyId,
      context,
    };
    if (attributes) payload.attributes = attributes;
    const res = await request(`${getUrl()}/event`, payload);
    log(`sent event`, res);
    return res;
  }

  async function feedback({
    feedbackId,
    featureId,
    question,
    score,
    userId,
    companyId,
    comment,
    promptId,
    promptedQuestion,
  }: Feedback) {
    checkKey();
    if (!featureId) err("No featureId provided");
    if (!score && !comment) err("Either 'score' or 'comment' must be provided");
    userId = resolveUser(userId);

    const payload: Feedback & { userId: User["userId"] } = {
      feedbackId,
      userId,
      featureId,
      score,
      companyId,
      comment,
      promptId,
      question,
      promptedQuestion,
    };

    const res = await request(`${getUrl()}/feedback`, payload);
    log(`sent feedback`, res);
    return res;
  }

  /**
   * @deprecated Use `initLiveSatisfaction` instead
   */
  const initLiveFeedback = initLiveSatisfaction;
  async function initLiveSatisfaction(userId?: User["userId"]) {
    checkKey();

    if (isForNode) {
      err("Feedback prompting is not supported in Node.js environment");
    }

    if (liveSatisfactionActive) {
      err("Feedback prompting already initialized. Use reset() first.");
    }

    if (isMobile) {
      warn("Feedback prompting is not supported on mobile devices");
      return;
    }

    userId = resolveUser(userId);

    // while initializing, consider the channel active
    liveSatisfactionActive = true;
    try {
      const res = await request(`${getUrl()}/feedback/prompting-init`, {
        userId,
      });

      log(`feedback prompting status sent`, res);
      const body: { success: boolean; channel?: string } = await res.json();
      if (!body.success || !body.channel) {
        log(`feedback prompting not enabled`);
        return res;
      }

      log(`feedback prompting enabled`);

      sseChannel = openAblySSEChannel(
        `${getUrl()}/feedback/prompting-auth`,
        userId,
        body.channel,
        (message) => handleFeedbackPromptRequest(userId!, message),
        { debug, sseHost },
      );

      feedbackPromptingUserId = userId;

      log(`feedback prompting connection established`);
      return res;
    } finally {
      // check that SSE channel has actually been opened, otherwise reset the value
      liveSatisfactionActive = !!sseChannel;
    }
  }

  function handleFeedbackPromptRequest(userId: User["userId"], message: any) {
    const parsed = parsePromptMessage(message);
    if (!parsed) {
      err(`invalid feedback prompt message received`, message);
    } else {
      if (
        !processPromptMessage(userId, parsed, async (u, m, cb) => {
          await feedbackPromptEvent({
            promptId: parsed.promptId,
            featureId: parsed.featureId,
            promptedQuestion: parsed.question,
            event: "received",
            userId,
          });
          await triggerFeedbackPrompt(u, m, cb);
        })
      ) {
        log(
          `feedback prompt not shown, it was either expired or already processed`,
          message,
        );
      }
    }
  }

  async function triggerFeedbackPrompt(
    userId: User["userId"],
    message: FeedbackPrompt,
    completionHandler: FeedbackPromptCompletionHandler,
  ) {
    let feedbackId: string | undefined = undefined;

    if (feedbackPromptingUserId !== userId) {
      log(
        `feedback prompt not shown, received for another user`,
        userId,
        message,
      );
      return;
    }

    await feedbackPromptEvent({
      promptId: message.promptId,
      featureId: message.featureId,
      promptedQuestion: message.question,
      event: "shown",
      userId,
    });

    const replyCallback: FeedbackPromptReplyHandler = async (reply) => {
      if (!reply) {
        await feedbackPromptEvent({
          promptId: message.promptId,
          featureId: message.featureId,
          event: "dismissed",
          userId,
          promptedQuestion: message.question,
        });

        completionHandler();
        return;
      }

      const response = await feedback({
        feedbackId: feedbackId,
        featureId: message.featureId,
        userId,
        companyId: reply.companyId,
        score: reply.score,
        comment: reply.comment,
        promptId: message.promptId,
        question: reply.question,
        promptedQuestion: message.question,
      });

      completionHandler();
      return await response.json();
    };

    const handlers: FeedbackPromptHandlerCallbacks = {
      reply: replyCallback,
      openFeedbackForm: (options) => {
        feedbackLib.openFeedbackForm({
          key: message.featureId,
          title: message.question,
          onScoreSubmit: async (data) => {
            const res = await replyCallback(data);
            feedbackId = res.feedbackId;
            return { feedbackId: res.feedbackId };
          },
          onSubmit: async (data) => {
            await replyCallback(data);
            options.onAfterSubmit?.(data);
          },
          onDismiss: () => replyCallback(null),
          position: feedbackPosition,
          translations: feedbackTranslations,
          ...options,
        });
      },
    };

    feedbackPromptHandler?.(message, handlers);
  }

  async function feedbackPromptEvent(args: {
    event: "received" | "shown" | "dismissed";
    featureId: string;
    promptId: string;
    promptedQuestion: string;
    userId: User["userId"];
  }) {
    checkKey();
    if (!args.promptId) err("No promptId provided");
    if (!args.event) err("No event provided");

    const payload = {
      action: args.event,
      featureId: args.featureId,
      promptId: args.promptId,
      userId: args.userId,
      promptedQuestion: args.promptedQuestion,
    };

    const res = await request(`${getUrl()}/feedback/prompt-events`, payload);
    log(`sent prompt event`, res);
    return res;
  }

  function requestFeedback(options: RequestFeedbackOptions) {
    if (isForNode) {
      err("requestFeedback can only be called in the browser");
    }

    if (!options.featureId) {
      err("No featureId provided");
    }

    if (persistUser) {
      options.userId = getSessionUser();
    } else if (!options.userId) {
      err("No userId provided and persistUser is disabled");
    }

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        key: options.featureId,
        title: options.title,
        position: options.position ?? feedbackPosition,
        translations: options.translations ?? feedbackTranslations,
        openWithCommentVisible: options.openWithCommentVisible,
        onClose: options.onClose,
        onDismiss: options.onDismiss,
        onScoreSubmit: async (data) => {
          const res = await feedback({
            featureId: options.featureId,
            userId: options.userId,
            companyId: options.companyId,
            ...data,
          });

          const json = await res.json();
          return { feedbackId: json.feedbackId };
        },
        onSubmit: async (data) => {
          // Default onSubmit handler
          await feedback({
            featureId: options.featureId,
            userId: options.userId,
            companyId: options.companyId,
            ...data,
          });

          options.onAfterSubmit?.(data);
        },
      });
    }, 1);
  }

  function reset() {
    sessionUserId = undefined;
    feedbackPromptingUserId = undefined;
    liveSatisfactionActive = false;
    if (sseChannel) {
      closeAblySSEChannel(sseChannel);
      log(`feedback prompting connection closed`);

      sseChannel = undefined;
    }
  }

  return {
    // lifecycle
    init,
    reset,
    // requests
    user,
    company,
    track,
    feedback,
    // feedback prompting
    requestFeedback,
    initLiveSatisfaction,
    initLiveFeedback,
  };
}
