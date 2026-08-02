# AI intelligence public entrypoint

Role 2 owns implementations behind the provider ports exported by `index.ts`. Consumers import this public module or `@/core`, never Role 2 private adapters, prompts, provider payloads, or analysis internals.

Role 1 created this additive boundary under the recorded integration override so Role 2 can start independently. No model, provider, prompt, algorithm, or candidate-generation behavior is selected here.
