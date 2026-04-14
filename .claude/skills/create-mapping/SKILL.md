---
name: create-mapping
description: Creates FHIR Mapping YAML resources (extraction mappings) that transform QuestionnaireResponse data into FHIR resources. Use when the user asks to create a mapping, extraction, or when building the server-side logic that processes questionnaire submissions. Triggers on "create mapping", "add mapping", "extraction mapping", "mapping YAML", or when the task involves creating files in resources/init-seeds/Mapping/.
disable-model-invocation: false
---

# Create FHIR Mapping

## Overview

This skill provides a structured workflow for creating FHIR Mapping YAML resources. Mappings define how QuestionnaireResponse data is extracted and transformed into FHIR resources (Observations, Encounters, Conditions, etc.) using the Aidbox Mapping engine with Liquid templates or JUTE expressions.

## Skill Boundaries

- Use this skill when creating new Mapping YAML files in `resources/init-seeds/Mapping/`
- Every mapping has a corresponding questionnaire - if the questionnaire doesn't exist yet, use the `create-questionnaire` skill first
- If modifying an existing mapping, read the file first and apply changes carefully

## Prerequisites

- The corresponding Questionnaire YAML must exist or be created alongside the mapping
- Know all `linkId` values from the questionnaire (these are keys for extracting answers)
- Know the item types (determines value access patterns: `.code`, `.reference`, `.value`, etc.)
- Know which FHIR resources should be created, updated, or patched

## Required Workflow

**Follow these steps in order. Do not skip steps.**

### Step 1: Read the Source Questionnaire

Before writing any mapping code, read the corresponding questionnaire YAML to catalog:
- All `linkId` values and their item types
- LaunchContext variables (accessible as `%VariableName` in the mapping)
- The questionnaire ID (determines the mapping ID: `{questionnaire-id}-extract`)

### Step 2: Choose Template Engine

**Prefer Liquid (FHIRPath type)** for new mappings - it's the dominant pattern in this project.

**Liquid (FHIRPath) - PREFERRED:**
```yaml
resourceType: Mapping
id: mapping-id-extract
type: FHIRPath
body:
  "{% assign %}":
    - variable: "{{ expression }}"
  resourceType: Bundle
  type: transaction
  entry: [...]
```

**JUTE - for complex logic with functions, switch statements, or nested conditionals:**
```yaml
resourceType: Mapping
id: mapping-id-extract
type: JUTE
body:
  $let:
    variable: $ expression
  $body:
    resourceType: Bundle
    type: transaction
    entry: [...]
```

### Step 3: Extract Variables

**Liquid variable extraction:**
```yaml
"{% assign %}":
  - patientId: "{{ %QuestionnaireResponse.answers('patient-id') }}"
  - noteText: "{{ %QuestionnaireResponse.answers('note-text') }}"
  - status: "{{ %QuestionnaireResponse.answers('status') }}"
  - author: "{{ %Author }}"
```

**Value access by questionnaire item type:**

| Item Type | Extraction | Access Properties |
|-----------|-----------|-------------------|
| `string` | `answers('linkId')` | Direct string value |
| `text` | `answers('linkId')` | Direct string value |
| `integer` | `answers('linkId')` | Direct integer value |
| `decimal` | `answers('linkId')` | `.value` for number |
| `boolean` | `answers('linkId')` | Direct boolean |
| `date` / `dateTime` | `answers('linkId')` | Direct date string |
| `choice` (valueCoding) | `answers('linkId')` | `.code`, `.display`, `.system` |
| `reference` | `answers('linkId')` | `.reference`, `.display` |
| `quantity` | `answers('linkId')` | `.value`, `.unit`, `.code`, `.system` |

**Built-in variables (no extraction needed):**
- `%Author` - Current user (Practitioner/PractitionerRole/Organization)
- `%QuestionnaireResponse` - The full response being processed
- Any launchContext variable from the questionnaire (e.g., `%Encounter`, `%Patient`)
- `now()` - Current timestamp function

### Step 4: Build Transaction Entries

**POST - Create new resource:**
```yaml
entry:
  - request:
      method: POST
      url: /Observation
    resource:
      resourceType: Observation
      status: final
      subject:
        reference: "{{ 'Patient/' + %patientId }}"
```

**PATCH - Update specific fields only:**

> **CRITICAL: PATCH body must never be empty.** The Liquid template engine strips keys whose values evaluate to null. If ALL values in the `resource` block evaluate to null, the body becomes `{}` and Aidbox returns `422: "Please provide body for patch"`. For dynamic values (especially from `choice` items), always use `iif()` to guarantee a non-null value. See the PATCH pitfall below.

```yaml
entry:
  - request:
      method: PATCH
      url: "/Encounter/{{ %encounterId }}"
    resource:
      status: "{{ iif(%newStatus.code.exists(), %newStatus.code, %newStatus) }}"
```

**PUT - Replace entire resource:**
```yaml
entry:
  - request:
      method: PUT
      url: "/Condition/{{ %conditionId }}"
    resource:
      resourceType: Condition
      # All required fields must be present
```

**Conditional POST or PUT (create-or-update):**
```yaml
entry:
  - request:
      "{% if %existingId.exists() %}":
        method: PUT
        url: "/ResourceType/{{ %existingId }}"
      "{% else %}":
        method: POST
        url: /ResourceType
    resource:
      resourceType: ResourceType
```

**Conditional entry inclusion (skip if data missing):**
```yaml
entry:
  - "{% if %temperature.exists() %}":
      request:
        method: POST
        url: /Observation
      resource:
        resourceType: Observation
        # ...
```

### Step 5: Build Resource Properties

**Simple values:**
```yaml
status: "{{ %status.code }}"
text: "{{ %noteText }}"
effectiveDateTime: "{{ now() }}"
```

**Choice values safe for PATCH** (handles both Coding and string):
```yaml
status: "{{ iif(%status.code.exists(), %status.code, %status) }}"
```

**References:**
```yaml
subject:
  reference: "{{ 'Patient/' + %patientId }}"
  display: "{{ %patientName }}"

# From a reference-type answer:
subject:
  reference: "{{ %patientRef.reference }}"
  display: "{{ %patientRef.display }}"
```

**CodeableConcept:**
```yaml
code:
  coding:
    - code: "{{ %typeOfCare.code }}"
      system: "{{ %typeOfCare.system }}"
      display: "{{ %typeOfCare.display }}"
```

**Quantity:**
```yaml
valueQuantity:
  value: "{{ %temperature.value }}"
  unit: "C"
  code: Cel
  system: http://unitsofmeasure.org
```

**Conditional properties (include only when value exists):**
```yaml
priority:
  "{% if %encounterCode.exists() %}":
    coding:
      - code: "{{ %encounterCode.code }}"
        system: "{{ %encounterCode.system }}"
        display: "{{ %encounterCode.display }}"
```

**Iteration (for repeating items):**
```yaml
diagnosis:
  "{% for dx in %dxCodes %}":
    - condition:
        display: "{{ %dx }}"

specialty:
  - "{% for item in %specialties %}":
      coding:
        - "{{ %item }}"
```

**Merge pattern (conditionally add multiple properties):**
```yaml
resource:
  resourceType: Provenance
  "{% merge %}":
    - "{% if %author.exists() %}":
        agent:
          - who:
              reference: "{{ %author.resourceType + '/' + %author.id }}"
    - "{% if %qrId.exists() %}":
        entity:
          - role: source
            what:
              uri: "QuestionnaireResponse/{{ %qrId }}"
```

**Inline conditional values (iif):**
```yaml
status: "{{ iif(%provision.code = 'permit', 'active', 'inactive') }}"
method: "{{ iif(%existingId.exists(), 'PUT', 'POST') }}"
```

### Step 6: Handle Author References and Display Names

**CRITICAL: Never hardcode the resource type in Author references.** `%Author` can be a Practitioner, PractitionerRole, or Organization depending on the user's role. Hardcoding `'Practitioner/' + %author.id` will fail when an Admin (Organization) submits the form, producing "Referenced resource Practitioner/org-id does not exist" errors.

**Always build the reference dynamically:**
```yaml
reference: "{{ %author.resourceType + '/' + %author.id }}"
```

**Display names differ by resource type** - Organization has `.name` as a plain string, while Practitioner/PractitionerRole has `.name` as a HumanName array. Always handle both:
```yaml
sender:
  "{% if %author.exists() %}":
    reference: "{{ %author.resourceType + '/' + %author.id }}"
    display: "{{ iif(%author.resourceType = 'Organization', %author.name, %author.name.first().given.first() + ' ' + %author.name.first().family) }}"
```

### Step 7: Cross-Resource References Within Transaction

Use `fullUrl` with URN UUIDs for forward references in the same transaction:

```yaml
entry:
  - fullUrl: "urn:uuid:new-observation"
    request:
      method: POST
      url: /Observation
    resource:
      resourceType: Observation
      # ...

  - request:
      method: POST
      url: /Condition
    resource:
      resourceType: Condition
      evidence:
        - detail:
            - uri: "urn:uuid:new-observation"
```

### Step 8: Add Provenance (for audit trail)

If the operation needs tracking:

```yaml
  - request:
      method: POST
      url: /Provenance
    resource:
      resourceType: Provenance
      target:
        - uri: "urn:uuid:created-resource"
      recorded: "{{ iif(%QuestionnaireResponse.meta.lastUpdated.exists(), %QuestionnaireResponse.meta.lastUpdated, now()) }}"
      activity:
        coding:
          - system: http://terminology.hl7.org/CodeSystem/v3-DataOperation
            code: CREATE
            display: create
      agent:
        - who:
            reference: "{{ %Author.resourceType + '/' + %Author.id }}"
      entity:
        - role: source
          what:
            uri: "QuestionnaireResponse/{{ %QuestionnaireResponse.id }}"
```

### Step 9: Validate FHIRPath Expressions

**Use the `mcp__fhirpath-validator__validate-fhirpath` MCP tool** to validate FHIRPath expressions used inside `{{ }}` templates. For each expression that navigates a FHIR resource path (e.g., `%Encounter.subject.reference`, `%Author.name.first().family`), call the validator with the appropriate `contextType`.

**What to validate:**
- Resource property paths: `.id`, `.status`, `.subject.reference`, `.name.first().given.first()`
- FHIRPath functions: `.exists()`, `.first()`, `.where()`, `.count()`
- Conditional expressions used in `iif()` calls

**What the validator cannot check (expected):**
- Launch context variables (`%Author`, `%Encounter`) — "variable not found" is normal for these
- `%QuestionnaireResponse.answers('linkId')` — this is an Aidbox-specific extension
- Liquid template syntax (`{% if %}`, `{% for %}`, `{% assign %}`)

### Step 10: Assemble and Save

```yaml
resourceType: Mapping
id: questionnaire-id-extract
type: FHIRPath
body:
  "{% assign %}":
    - var1: "{{ %QuestionnaireResponse.answers('linkId1') }}"
    - var2: "{{ %QuestionnaireResponse.answers('linkId2') }}"

  resourceType: Bundle
  type: transaction
  entry:
    - request:
        method: POST
        url: /ResourceType
      resource:
        resourceType: ResourceType
        # properties using extracted variables
```

Save to: `resources/init-seeds/Mapping/{questionnaire-id}-extract.yaml`

**Ensure the mapping ID matches the questionnaire's mapping reference:**
- Questionnaire: `mapping: [{ reference: "urn:uuid:Mapping:questionnaire-id-extract" }]`
- Mapping: `id: questionnaire-id-extract`

## JUTE Syntax Reference

For complex mappings that need functions, switch statements, or deep nesting:

**Variable assignment with helper functions:**
```yaml
type: JUTE
body:
  $let:
    patientId: $ answer('patientId', 'valueString')
    answer:
      $fn: ["linkId", "type"]
      $name: answer
      $body: $ fhirpath("QuestionnaireResponse.repeat(item).where(linkId='" + linkId + "').answer." + type).0
  $body:
    resourceType: Bundle
    type: transaction
    entry: [...]
```

**Conditionals:**
```yaml
$if: $ condition
$then: value_if_true
$else: value_if_false
```

**Switch:**
```yaml
$switch: $ variable
case1: result1
case2: result2
$default: default_result
```

**Iteration:**
```yaml
$map: $ collection
$as: item
$body:
  property: $ item.value
```

**Range iteration:**
```yaml
$map: $ range(0, count, 1)
$body:
  # repeated entry template
```

## Common Pitfalls

1. **Mismatched linkId**: `answers('linkId')` must exactly match the questionnaire's `linkId`. Double-check spelling and casing.

2. **Wrong value access for choice items**: Choice answers from `valueCoding` are Coding objects. Use `.code` for the code, `.display` for text, `.system` for system URI. Don't treat them as plain strings.

3. **Missing existence checks**: Wrap optional fields with `{% if %var.exists() %}` to avoid creating empty properties that may cause FHIR validation errors.

4. **Reference answers need `.reference` and `.display`**: A reference-type answer returns an object with `.reference` (e.g., `Patient/123`) and `.display` (e.g., `John Doe`).

5. **LaunchContext variable name mismatch**: `%CurrentEncounter` vs `%Encounter` - the variable name must match what the TypeScript code passes in `launchContextParameters`.

6. **Missing `resourceType` in POST/PUT entries**: POST and PUT require `resourceType` in the resource body. PATCH does not.

7. **PATCH with extra fields**: PATCH should only include fields being updated. Don't include `resourceType` or unchanged fields.

8. **Wrong URL for PATCH/PUT**: Must include resource ID: `/Encounter/{{ %id }}`, not just `/Encounter`.

9. **Author resourceType assumption**: Never write `'Practitioner/' + %author.id` - always use `%author.resourceType + '/' + %author.id`. `%Author` can be Practitioner, PractitionerRole, or Organization depending on the user's role. Also use `iif()` for display names since Organization has a plain string `.name` while Practitioner has a HumanName array.

10. **Forgetting `type: transaction`**: The Bundle wrapper must have `type: transaction`.

11. **Loop variable prefix**: In `{% for item in %collection %}`, access the loop variable as `%item` (with percent prefix).

12. **String vs Coding**: For `choice` items, `answers('linkId')` returns a Coding object, not a string. Use `.code` to get the code value.

13. **PATCH body becomes empty with null-evaluating expressions**: The Liquid template engine strips keys whose values evaluate to null. If the ONLY field in a PATCH `resource` block uses a dynamic expression like `"{{ %status.code }}"` and it evaluates to null, the entire body becomes `{}`, causing `422: "Please provide body for patch"`. This commonly happens with `choice` items when the questionnaire has an `initialExpression` that returns a raw string (e.g., `%Encounter.status` → `"planned"`) but the `answerOption` values are `valueCoding`. The `answers()` function may return the string directly, and calling `.code` on a string returns null. **Fix**: Always use `iif()` to handle both Coding and string values in PATCH:
    ```yaml
    # WRONG - can produce empty body:
    resource:
      status: "{{ %status.code }}"

    # CORRECT - always produces a value:
    resource:
      status: "{{ iif(%status.code.exists(), %status.code, %status) }}"
    ```
    This pattern returns `.code` when `%status` is a Coding, or the raw string when `%status` is already a code string. Use this pattern for ALL dynamic values in PATCH resource bodies.

## Finding Examples

Before creating a mapping, search the current project for existing Mapping YAML files (typically in a directory like `resources/` or `seeds/`). Existing mappings are the best reference for project-specific conventions, supported template engine features, and common resource creation patterns. Look for mappings that match what you need: simple PATCH operations, resource creation with POST, conditional create-or-update logic, multi-resource bundles, iteration patterns, or provenance tracking.
