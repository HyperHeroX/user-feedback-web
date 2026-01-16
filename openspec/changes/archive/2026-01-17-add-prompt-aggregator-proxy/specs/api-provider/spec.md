# Spec: API Provider (Delta)

## MODIFIED Requirements

### Requirement: API Provider Integration
The `APIProvider` SHALL use `PromptAggregator` for prompt construction while maintaining existing caching and retry logic.

#### Scenario: API provider uses prompt aggregator
- **GIVEN** an API mode AI request
- **WHEN** `APIProvider.generateReply(request)` is called
- **THEN** use `PromptAggregator.aggregate()` to build the prompt
- **AND** NOT use internal `buildPrompt()` method

#### Scenario: API provider maintains caching
- **GIVEN** identical AI requests within cache TTL
- **WHEN** `APIProvider.generateReply(request)` is called
- **THEN** return cached response if available
- **AND** cache key is based on aggregated prompt content

#### Scenario: API provider includes prompt in response
- **GIVEN** any API mode AI request
- **WHEN** `APIProvider.generateReply(request)` returns successfully
- **THEN** response includes `promptSent` field with full aggregated prompt
