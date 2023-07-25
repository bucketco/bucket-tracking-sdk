import { h, render } from "preact";
import { FeedbackDialog } from "./FeedbackDialog";
import { FeedbackDialogOptions } from "./types";

const feedbackContainerId = "bucket-feedback-dialog-container";

function attachDialogContainer() {
  let container = document.querySelector(`#${feedbackContainerId}`);

  if (!container) {
    container = document.createElement("div");
    container.attachShadow({ mode: "open" });
    (container as HTMLElement).style.all = "initial";
    container.id = feedbackContainerId;
    document.body.appendChild(container);
  }

  return container.shadowRoot!;
}

export function collectFeedback(options: FeedbackDialogOptions): void {
  const shadowRoot = attachDialogContainer();

  render(h(FeedbackDialog, options), shadowRoot);

  const dialog = shadowRoot.querySelector("dialog");

  if (dialog && !dialog.hasAttribute("open")) {
    dialog[options.isModal ? "showModal" : "show"]();
  }
}
