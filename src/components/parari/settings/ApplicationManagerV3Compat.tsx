"use client";

import * as React from "react";

function setReactInputValue(
  input: HTMLInputElement,
  value: string,
) {
  const setter =
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(
    new Event("input", {
      bubbles: true,
    }),
  );
}

function hasCalendarBlock(
  root: HTMLElement,
): boolean {
  return Array.from(
    root.querySelectorAll("select option"),
  ).some(
    (option) =>
      option.textContent?.trim() ===
      "CALENDARを選択",
  );
}

function findPaymentSection(
  root: HTMLElement,
): HTMLElement | null {
  const headings =
    Array.from(
      root.querySelectorAll("div"),
    );

  for (const heading of headings) {
    if (
      heading.textContent?.trim() !==
      "支払"
    ) {
      continue;
    }

    const section =
      heading.parentElement;

    if (
      section instanceof HTMLElement &&
      section.querySelector("select")
    ) {
      return section;
    }
  }

  return null;
}

function applyPaymentUiV3(
  root: HTMLElement,
) {
  const section =
    findPaymentSection(root);

  if (!section) {
    return;
  }

  const intro =
    section.querySelector("p");

  const introText =
    "無料、現地払い、PARARI決済から選びます。PARARI決済はSquare連携後に利用できます。";

  if (
    intro &&
    intro.textContent?.trim() !==
      introText
  ) {
    intro.textContent = introText;
  }

  const select =
    section.querySelector("select");

  if (
    select instanceof HTMLSelectElement
  ) {
    const noneOption =
      select.querySelector(
        'option[value="none"]',
      );

    if (
      noneOption &&
      noneOption.textContent !== "無料"
    ) {
      noneOption.textContent = "無料";
    }

    const onsiteOption =
      select.querySelector(
        'option[value="on_site"]',
      );

    if (
      onsiteOption &&
      onsiteOption.textContent !==
        "現地払い"
    ) {
      onsiteOption.textContent =
        "現地払い";
    }

    for (const legacy of [
      [
        "bank_transfer",
        "銀行振込（旧設定）",
      ],
      [
        "payment_link",
        "支払リンク（旧設定）",
      ],
    ] as const) {
      const option =
        select.querySelector(
          `option[value="${legacy[0]}"]`,
        );

      if (!(option instanceof HTMLOptionElement)) {
        continue;
      }

      if (
        option.textContent !== legacy[1]
      ) {
        option.textContent = legacy[1];
      }

      const isCurrent =
        select.value === legacy[0];

      option.hidden = !isCurrent;
      option.disabled = !isCurrent;
    }

    if (
      !select.querySelector(
        'option[value="__parari_pending__"]',
      )
    ) {
      const option =
        document.createElement("option");

      option.value =
        "__parari_pending__";
      option.textContent =
        "PARARI決済（準備中）";
      option.disabled = true;

      select.appendChild(option);
    }
  }

  const calendarPricing =
    hasCalendarBlock(root);

  let notice =
    section.querySelector(
      "[data-application-calendar-pricing-notice]",
    );

  if (calendarPricing) {
    if (!notice) {
      notice =
        document.createElement("div");

      notice.setAttribute(
        "data-application-calendar-pricing-notice",
        "true",
      );
      notice.className =
        "mt-4 rounded-xl bg-neutral-50 px-4 py-3";
      notice.innerHTML =
        '<div class="text-sm font-bold text-neutral-900">料金は各開催回で設定します</div><p class="mt-1 text-xs leading-5 text-neutral-500">CALENDARを使う募集では、APPLICATION側に参加費を重複して設定しません。</p>';

      const selectContainer =
        select?.parentElement;

      if (selectContainer) {
        selectContainer.insertAdjacentElement(
          "afterend",
          notice,
        );
      }
    }
  } else if (notice) {
    notice.remove();
    notice = null;
  }

  const feeLabel =
    Array.from(
      section.querySelectorAll("label"),
    ).find(
      (label) =>
        label.textContent?.trim() ===
        "参加費",
    );

  const feeContainer =
    feeLabel?.parentElement;

  if (
    feeContainer instanceof HTMLElement
  ) {
    feeContainer.style.display =
      calendarPricing ? "none" : "";

    const input =
      feeContainer.querySelector(
        'input[type="number"]',
      );

    if (
      input instanceof HTMLInputElement
    ) {
      if (calendarPricing) {
        if (
          !input.value ||
          input.dataset
            .calendarPricingSentinel ===
            "true"
        ) {
          input.dataset.calendarPricingSentinel =
            "true";

          if (input.value !== "1") {
            setReactInputValue(
              input,
              "1",
            );
          }
        }
      } else if (
        input.dataset
          .calendarPricingSentinel ===
          "true"
      ) {
        delete input.dataset
          .calendarPricingSentinel;
        setReactInputValue(
          input,
          "",
        );
      }
    }
  }
}

export function useApplicationPaymentUiV3(
  rootRef: React.RefObject<HTMLDivElement | null>,
) {
  React.useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    let frame = 0;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyPaymentUiV3(root);
      });
    };

    apply();

    const observer =
      new MutationObserver(apply);

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rootRef]);
}
