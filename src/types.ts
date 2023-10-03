import {
  FeedbackPosition,
  FeedbackSubmission,
  FeedbackTranslations,
  OpenFeedbackFormOptions,
} from "./feedback/types";

export type Key = string;

export type Options = {
  persistUser?: boolean;
  host?: string;
  debug?: boolean;
  feedback?: {
    live?: boolean;
    liveHandler?: FeedbackPromptHandler;
    ui?: {
      /**
       * Control the placement and behavior of the feedback form.
       */
      position?: FeedbackPosition;

      /**
       * Add your own custom translations for the feedback form.
       * Undefined translation keys fall back to english defaults.
       */
      translations?: Partial<FeedbackTranslations>;
    };
  };
};

export type User = {
  userId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type Company = {
  userId: User["userId"];
  companyId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type TrackedEvent = {
  event: string;
  userId: User["userId"];
  companyId?: Company["companyId"];
  attributes?: {
    [key: string]: any;
  };
  context?: Context;
};

export interface RequestFeedbackOptions
  extends Omit<OpenFeedbackFormOptions, "key" | "onSubmit"> {
  featureId: string;
  userId: string;
  companyId?: string;

  /**
   * Allows you to handle a copy of the already submitted
   * feedback.
   *
   * This can be used for side effects, such as storing a
   * copy of the feedback in your own application or CRM.
   *
   * @param {Object} data
   * @param data.
   */
  onAfterSubmit?: (data: FeedbackSubmission) => void;
}

export type Feedback = {
  /**
   * Bucket feature ID
   */
  featureId: string;

  /**
   * User id from your own application
   */
  userId?: User["userId"];

  /**
   * Company id from your own application
   */
  companyId?: Company["companyId"];

  /**
   * Customer satisfaction score
   */
  score?: number;

  /**
   * User supplied comment about your feature
   */
  comment?: string;

  /**
   * Bucket feedback prompt id.
   *
   * This only exists if the feedback was submitted
   * as part of an automated prompt from Bucket.
   *
   * Used for internal state management of automated
   * feedback.
   */
  promptId?: FeedbackPrompt["promptId"];
};

export type FeedbackPrompt = {
  question: string;
  showAfter: Date;
  showBefore: Date;
  promptId: string;
  featureId: Feedback["featureId"];
};

export type FeedbackPromptReply = {
  companyId?: Company["companyId"];
  score?: FeedbackSubmission["score"];
  comment?: FeedbackSubmission["comment"];
};

export type FeedbackPromptReplyHandler = (
  reply: FeedbackPromptReply | null,
) => Promise<void>;

export type FeedbackPromptHandlerCallbacks = {
  reply: FeedbackPromptReplyHandler;
  // dismiss: function,
  openFeedbackForm: (
    options: Omit<
      RequestFeedbackOptions,
      "featureId" | "userId" | "companyId" | "onClose" | "onDismiss"
    >,
  ) => void;
};

export type FeedbackPromptHandler = (
  prompt: FeedbackPrompt,
  handlers: FeedbackPromptHandlerCallbacks,
) => void;

export type Context = {
  active?: boolean;
};
