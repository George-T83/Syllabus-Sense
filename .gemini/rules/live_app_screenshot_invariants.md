# Live App Screenshot Invariants

- Never capture screenshots during loading shimmers or before Next.js route hydration completes.
- Trigger explicit modal/drawer DOM buttons (`button.click()`) before capturing interactive features.
- Ensure artifact image embeds use exact absolute paths in the artifact root directory.
