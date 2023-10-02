# Bucket Feedback UI

The Bucket SDK includes a UI you can use to collect feedback from user about particular features.

## Global feedback configuration

The Bucket SDK feedback UI is configured with reasonable defaults of an english language, positioning itself as a [dialog](#dialog) in the lower right-hand corner of the viewport and with a [light-mode theme](#custom-styling).

These settings can be overwritten when initializing the Bucket SDK:

```javascript
bucket.init("bucket-tracking-key", {
  feedback: {
    ui: {
      position: POSITION_CONFIG, // See positioning section
      translations: TRANSLATION_KEYS, // See internationalization section

      // Enable automated fedback collection. Default: `false`
      automaticPrompting: boolean,

      /**
       * Do your own feedback prompt handling or override
       * default settings at runtime.
       */
      promptHandler: (promptMessage, handlers) => {
        // See automated feedback collection section
      },
    },
  },
});
```

See also:

- [Positioning and behavior](#positioning-and-behavior) for the position option.
- [Static language configuration](#static-language-configuration) if you want to translate the feedback UI.
- [Automated feedback collection](#automated-feedback-collection) to override default configuration.

## Manual feedback collection

You can open up the feedback collection UI by calling `bucket.requestFeedback(options)` with the relevant options. This is great is you are interested in manually controlling the collection of feedback from your user, but want to use the convenience of the Bucket feedback UI to reduce the amount of code you need to maintain.

Examples of this could be if you want to put a `give us feedback`-button on your page, or pop up the feedback UI at the end of specific user flows in your app.

### bucket.requestFeeback() options

Minimal usage with defaults:

```javascript
bucket.requestFeedback({
  featureId: "bucket-feature-id",
  title: "How satisfied are you with file uploads?",
});
```

All options:

```javascript
bucket.requestFeedback({
  featureId: "bucket-feature-id", // required
  userId: "your-user-id", // optional if user persistence is enabled (default in browsers),
  companyId: "users-company-or-account-id", // optional
  title: "How satisfied are you with file uploads?"

  position: POSITION_CONFIG, // See positioning section
  translations: TRANSLATION_KEYS // See internationalization section

  // Trigger side effects with the collected data,
  // for example posting it back into your own CRM
  onAfterSubmit: (feedback) => {
    storeFeedbackInCRM({
      score: feedback.score,
      comment: feedback.comment
    })
  }
})
```

See also:

- [Positioning and behavior](#positioning-and-behavior) for the position option.
- [Runtime language configuration](#runtime-language-configuration) if you want to translate the feedback UI.

## Automated feedback collection

When automated feedback collection is enabled the Bucket SDK will stay in contact with the Bucket service. When a user triggers an event used in a feature, and the user is eligible for being prompted for feedback, the Bucket service will push an event to the SDK instance. By default, this event will open up the Bucket feedback UI, but you have some abilities to intercept this event and add your own overrides to it.

### Initializing automated feedback collection

You can enable automated collection in the `bucket.init()`-call:

```javascript
bucke.init({
  feedback: {
    automaticPrompting: true,
  },
});
```

### Overriding prompt event defaults

If you are not satisfied with the default UI behavior when an automated prompt event arrives, you can intercept and override settings like this:

```javascript
bucket.init({
  feedback: {
    automaticPrompting: true,
    promptHandler: (promptMessage, handlers) => {
      // Pass your overrides here. Everything is optional
      handlers.openFeedbackForm({
        title: promptMessage.question,

        position: POSITION_CONFIG, // See positioning section
        translations: TRANSLATION_KEYS, // See internationalization section

        // Trigger side effects with the collected data,
        // for example posting it back into your own CRM
        onAfterSubmit: (feedback) => {
          storeFeedbackInCRM({
            score: feedback.score,
            comment: feedback.comment,
          });
        },
      });
    },
  },
});
```

See also:

- [Positioning and behavior](#positioning-and-behavior) for the position option.
- [Runtime language configuration](#runtime-language-configuration) if you want to translate the feedback UI.
- [Use your own UI to collect feedback](#using-your-own-ui-to-collect-feedback) if the feedback UI doesn't match your design.

## Positioning and behavior

The feedback UI can be configured to be placed and behave in 3 different ways:

### Positioning configuration

#### Modal

A modal overlay with a backdrop that blocks interaction with the remaining page. Can be dismissed with `<ESC>` or a close button. It is always centered on the page, making it the primary thing the user needs to focus on.

Using a modal is the strongest possible push for feedback. You are interrupting the users normal flow, which can cause annoyance. A good use case fora modal is when the user finishes a linear flow that they don"t use often, for example setting up an account.

```javascript
position: {
  type: "MODAL";
}
```

#### Dialog

A dialog that appears in a corner of the viewport, but lets the user continue with their interaction with the page. Can be dismissed with a close button, but also automatically disappears after a relatively shot time period if the user does not interact with it.

Using a dialog is a soft push for feedback. It lets the user continue with their work with a minimal amount of intrusion. The user can opt in to responding, but is not required to. A good use case for this behavior is when a user used a feature where the expected outcome is predictable, possibly because they have used it multiple times before. For example: Uploading a file, switching to a different view of a visualization, visiting a specific page or manipulating some data.

The default feedback UI behavior is a dialog placed at the bottom right of the users viewport.

```javascript
position: {
  type: "DIALOG",
  placement: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}
```

#### Popover

A popover that is anchored relative to a DOM-element (typically a button). Can be dismissed with an outside click or pressing a close button.

You can use the popover mode to implement your own button to collect feedback manually.

```javascript
position: {
  type: "POPOVER",
  anchor: DOMElement
}
```

Popover feedback button example:

```html
<button id="feedbackButton">Tell us what you think</button>
<script>
  const button = document.getElementById("feedbackButton");
  button.addEventListener("click", (e) => {
    bucket.requestFeedback({
      featureId: "bucket-feature-id",
      userId: "your-user-id",
      title: "How do you like the popover?",
      position: {
        type: "POPOVER",
        anchor: e.currentTarget,
      },
    });
  });
</script>
```

## Internationalization (i18n)

The Feedback UI currently only comes in English. You can supply your own translation keys that will be used insude the UI by passing an object with your own translation keys.

See [default english localization keys](./src/feedback/config/defaultTranslations.tsx) for a reference of what translation keys can be supplied.

### Static language configuration

If you know the language at page load, you can configure your translation keys while initializing the Bucket SDK:

```javascript
bucket.init("my-tracking-key", {
  feedback: {
    ui: {
      translations: {
        // Your translation keys
      },
    },
  },
});
```

### Runtime language configuration

If you only know the users language after the page has loaded, you can provide translation keys in the two cases where you open the feedback UI:

### Manual feedback collection

```javascript
bucket.requestFeedback({
  ... // Other options
  translations: {
    // your translation keys
  }
})
```

### Automated feedback collection

When you are collecting feedback through the Bucket automation, you can intercept the default prompt handling and override the defaults.

If you set the prompt question in the Bucket app to be one of your own translation keys, you can even get a translated version of the question you want to ask your customer in the feedback UI.

```javascript
bucket.init({
  feedback: {
    promptHandler: (message, handlers) => {
      const translatedQuestion =
        i18nLookup[message.question] ?? message.question;
      handlers.openFeedbackForm({
        title: translatedQuestion,
        translations: {
          // your static translation keys
        },
      });
    },
  },
});
```

## Custom styling

You can adapt parts of the looks of the Bucket feedback UI by setting CSS custom properties on your CSS `:root`-scope.

Examples of custom styling can be found in our [development example stylesheet](./dev/index.css).

## Using your own UI to collect feedback

You may have very strict design guidelines for your app and maybe the Bucket feedback UI doesn't quite work for you.

In this case, you can implement your own feedback collection mechanism, which follows your own design guidelines.

This is the data type you need to collect:

```typescript
{
  /** Customer satisfaction score */
  score?: 1 | 2 | 3 | 4 | 5,
  comment?: string
}
```

Either `score` or `comment` must be defined in order to pass validation in the Bucket tracking API.

### Manual feedback collection

Examples of a HTML-form that collects the relevant data can be found in [feedback.html](./example/feedback/feedback.html) and [feedback.jsx](./example/feedback/feedback.jsx).

Once you have collected the feedback data, pass it along to `bucket.feedback()`:

```javascript
bucket.feedback({
  featureId: "bucket-feature-id",
  userId: "your-user-id",
  score: 5,
  comment: "Best thing I"ve ever tried!",
});
```

### Intercepting automated feedback collection events

When using automated feedback collection, Bucket will some times send a feedback prompt message to your users instance of the Bucket SDK. This will result in the feedback UI being opened.

You can intercept this behavior and open your own custom feedback collection form:

```javascript
bucket.init({
  feedback: {
    promptHandler: async (promptMessage, handlers) => {
      // This opens your custom UI
      customFeedbackCollection({
        // The question configured in the Bucket UI for the feature
        question: promptMessage.question,
        // When the user successfully submits feedback data.
        // Use this instead of `bucket.feedback()`, otherwise
        // the feedback prompt handler will keep being called
        // with the same prompt message
        onFeedbackSubmitted: (feedback) => {
          handlers.reply(feedback);
        },
        // When the user closes the custom feedback form
        // without leaving any response.
        // It is important to feed this back, otherwise
        // the feedback prompt handler will keep being called
        // with the same prompt message
        onFeedbackDismissed: () => {
          handlers.reply(null);
        },
      });
    },
  },
});
```