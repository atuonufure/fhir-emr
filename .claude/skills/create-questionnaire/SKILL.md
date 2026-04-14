---
name: create-questionnaire
description: Creates FHIR Questionnaire YAML resources for the Aidbox SDC engine. Use when the user asks to create a questionnaire, form, survey, assessment, or any data entry form backed by FHIR. Triggers on "create questionnaire", "add questionnaire", "new form", "questionnaire YAML", or when the task involves creating files in resources/init-seeds/Questionnaire/.
disable-model-invocation: false
---

# Create FHIR Questionnaire

## Overview

This skill provides a structured workflow for creating FHIR Questionnaire YAML resources that work with the Aidbox SDC (Structured Data Capture) engine. It covers launch context wiring, item type selection, expression authoring, and integration with the ResourceListPage framework.

## Skill Boundaries

- Use this skill when creating new Questionnaire YAML files in `resources/init-seeds/Questionnaire/`
- If the user also needs a mapping (extraction logic), use the `create-mapping` skill for the corresponding mapping file
- If the user is modifying an existing questionnaire, read the file first and apply changes carefully
- If the user is building a full list page (UI + questionnaire + mapping), this skill handles only the questionnaire portion

## Prerequisites

- Understand which FHIR resources the form will create/update (this determines the mapping)
- Know the action context: record action (on a specific resource row), header action (page-level button), or direct component usage
- Know which launch context variables are available at runtime

## Required Workflow

**Follow these steps in order. Do not skip steps.**

### Step 1: Determine Launch Context

**CRITICAL: LaunchContext variable naming must match how the TypeScript code provides them at runtime. Getting this wrong causes "Context variable X not defined" errors.**

There are three action contexts in ResourceListPage:

**A. Record actions** (`questionnaireAction` in `getRecordActions`):
- The framework passes `{ name: resource.resourceType, resource }` via `RecordQuestionnaireAction`
- For an Encounter list page, the variable name is `Encounter` (NOT `CurrentEncounter`)
- For a Patient list page, the variable name is `Patient`
- The launchContext `code` MUST match `resource.resourceType` exactly
- Additionally receives `defaultLaunchContext` from ResourceListPage props

**B. Header actions** (`questionnaireAction` in `getHeaderActions`):
- Only receives `defaultLaunchContext` from ResourceListPage props
- Does NOT receive any resource automatically
- Extra context can be passed via `extra.qrfProps.launchContextParameters` on the action

**C. Direct usage** (custom components like EncounterDetails):
- `launchContextParameters` are passed manually with explicit names
- Variable names can be custom (e.g., `CurrentEncounter`) since they're explicitly provided

**Rules:**
- NEVER declare a launchContext variable that won't be provided at runtime - the SDC engine validates this
- NEVER declare a launchContext variable that isn't referenced in any expression
- For `Author`, the component must explicitly pass it via `selectCurrentUserRoleResource()` through `defaultLaunchContext` or `extra.qrfProps.launchContextParameters`
- `Author` type should include the types that may use the form: `[PractitionerRole, Practitioner]` or `[Practitioner]`

**LaunchContext declaration syntax:**
```yaml
launchContext:
  - name:
      code: Encounter          # Variable name - accessed as %Encounter in expressions
    type:
      - Encounter              # Allowed FHIR resource type(s)
    description: Optional text
  - name:
      code: Author
    type:
      - PractitionerRole
      - Practitioner
```

### Step 2: Design Form Items

Choose item types based on the data being collected:

| Type | Use Case | Key Properties |
|------|----------|----------------|
| `string` | Single-line text | `maxLength` |
| `text` | Multi-line text area | - |
| `integer` | Whole numbers | - |
| `decimal` | Floating point numbers | `unit` |
| `quantity` | Numbers with units | `unitOption` |
| `boolean` | Yes/No toggle | - |
| `date` | Date picker | - |
| `dateTime` | Date and time combined | - |
| `time` | Time only | - |
| `choice` | Select from predefined options | `answerOption` or `answerExpression` |
| `open-choice` | Choice with custom input | `answerOption` |
| `reference` | FHIR resource lookup | `referenceResource`, `answerExpression`, `choiceColumn` |
| `attachment` | File upload | - |
| `display` | Read-only informational text | - |
| `group` | Container for nested items | `item` (children) |

### Step 3: Build Item Definitions

**Every item requires these properties:**
```yaml
- text: "Field Label"
  type: string
  linkId: unique-field-id       # Used in mapping to extract answers
```

**Common optional properties:**
```yaml
  required: true                # Mandatory field
  hidden: true                  # Hidden from UI, included in response
  readOnly: true                # Display only
  repeats: true                 # Allow multiple answers
```

**Pre-populate from launch context:**
```yaml
  initialExpression:
    language: text/fhirpath
    expression: "%Encounter.id"
```

**Auto-calculate from other fields (always pair with readOnly):**
```yaml
  calculatedExpression:
    language: text/fhirpath
    expression: "(%weight / (%height / 100).power(2)).round(2)"
  readOnly: true
```

**Conditional visibility:**
```yaml
  enableWhen:
    - question: other-linkId
      operator: "="              # =, !=, >, <, >=, <=, exists
      answer:
        boolean: true
  enableBehavior: all            # all = AND, any = OR

  # Or with FHIRPath for complex conditions:
  enableWhenExpression:
    language: text/fhirpath
    expression: "%Author.resourceType = 'Practitioner'"
```

**Reference items (FHIR resource lookup):**
```yaml
- text: "Select Patient"
  type: reference
  linkId: patient-ref
  referenceResource:
    - Patient
  answerExpression:
    language: application/x-fhir-query
    expression: "Patient?_count=25"
  choiceColumn:
    - forDisplay: true
      path: "name.given.first() + ' ' + name.family"
```

**Choice items with coding options:**
```yaml
- text: "Status"
  type: choice
  linkId: status
  answerOption:
    - valueCoding:
        system: http://hl7.org/fhir/encounter-status
        code: planned
        display: Planned
    - valueCoding:
        system: http://hl7.org/fhir/encounter-status
        code: finished
        display: Finished
```

**Item control codes (change UI rendering):**
```yaml
  itemControl:
    coding:
      - code: inline-choice     # Radio buttons / horizontal layout
```

Available codes: `inline-choice`, `slider`, `markdown-editor`, `wizard`, `group-table`, `group-tabs`, `row`, `phoneWidget`, `markdown`, `depression-score`

### Step 4: Add Contained Resources (if needed)

When expressions need data from related resources not in launch context:

```yaml
contained:
  - resourceType: Bundle
    id: RelatedDataBundle
    type: transaction
    entry:
      - request:
          method: GET
          url: /Resource?param={{%Encounter.id}}
sourceQueries:
  - reference: "#RelatedDataBundle"
```

The result is accessible as `%RelatedDataBundle` in FHIRPath expressions.

### Step 5: Validate FHIRPath Expressions

**Use the `mcp__fhirpath-validator__validate-fhirpath` MCP tool** to validate every FHIRPath expression you write in `initialExpression`, `calculatedExpression`, `enableWhenExpression`, and `choiceColumn.path`. Call it with the expression and the appropriate `contextType` (the FHIR resource type the expression navigates, e.g., `Patient`, `Encounter`).

**Important:** The validator will report "variable not found" for launch context variables (`%Encounter`, `%Patient`, `%Author`). This is expected - these are runtime variables injected by the SDC engine, not known to the static validator. Focus on validating that path navigation after the variable is correct (e.g., `.id`, `.status`, `.subject.reference` are valid properties for the resource type).

### Step 6: Assemble the YAML

```yaml
id: questionnaire-id
resourceType: Questionnaire
name: questionnaire-id
title: Human Readable Title
status: active
mapping:
  - reference: urn:uuid:Mapping:questionnaire-id-extract
launchContext:                    # Only if expressions reference context variables
  - name:
      code: Encounter
    type:
      - Encounter
item:
  - text: Field Label
    type: string
    linkId: field-id

meta:
  profile:
    - https://emr-core.beda.software/StructureDefinition/fhir-emr-questionnaire
url: https://aidbox.emr.beda.software/fhir/Questionnaire/questionnaire-id
```

Save to: `resources/init-seeds/Questionnaire/{questionnaire-id}.yaml`

## Common Pitfalls

1. **Wrong launchContext variable name**: Using `CurrentEncounter` when the framework provides `Encounter` via `RecordQuestionnaireAction`. Always verify how the questionnaire is opened.

2. **Declaring unused launchContext**: If no expression references `%Variable`, don't declare it. The SDC engine validates all declared variables are provided.

3. **Header action without provider**: Header actions only receive `defaultLaunchContext`. Ensure the ResourceListPage passes the needed context.

4. **Missing `referenceResource`**: Reference items must specify allowed FHIR resource types.

5. **Wrong expression language**: Use `application/x-fhir-query` for FHIR search queries in `answerExpression`, `text/fhirpath` for all other expressions.

6. **Missing `choiceColumn`**: Without it, reference dropdowns show raw IDs instead of readable labels.

7. **calculatedExpression without readOnly**: Calculated fields must be `readOnly: true`.

8. **Missing `meta.profile`**: Always include `https://emr-core.beda.software/StructureDefinition/fhir-emr-questionnaire`.

9. **Duplicate linkIds**: Every `linkId` must be unique. The mapping extracts answers by linkId.

10. **Missing mapping reference**: If the form creates/updates resources, it needs `mapping` pointing to a Mapping resource.

11. **Using `answers()` in questionnaire expressions**: The `answers('linkId')` function is **only available in mappings** (inside `{{ }}` Liquid templates). It is NOT available in questionnaire FHIRPath expressions (`initialExpression`, `calculatedExpression`, `enableWhenExpression`). To read data from a selected reference item in a questionnaire, use the **variable + x-fhir-query pattern**. Variables must be defined on the **same item or a parent item** that contains the `calculatedExpression` that references them — they are scoped to the item they're defined on and its children. Wrap related items in a `group` and place the variables on the group:
    ```yaml
    - linkId: patient-group
      type: group
      variable:
        - name: PatientRef
          language: text/fhirpath
          expression: "%context.item.where(linkId='patient-ref').answer.valueReference.reference"
        - name: SelectedPatient
          language: application/x-fhir-query
          expression: "{{ %PatientRef }}"
      item:
        - linkId: patient-ref
          type: reference
          referenceResource:
            - Patient
          answerExpression:
            language: application/x-fhir-query
            expression: "Patient?_count=25"
          choiceColumn:
            - forDisplay: true
              path: "name.given.first() + ' ' + name.family"
        - linkId: birth-date
          type: date
          readOnly: true
          calculatedExpression:
            language: text/fhirpath
            expression: "%SelectedPatient.entry.resource.birthDate"
    ```
    The `variable` on the parent group extracts the reference string, fetches the resource via x-fhir-query, and child items read from the fetched result via `%VariableName.entry.resource`. Never place variables on a sibling item and expect them to be visible — they must be on the same level or above.

## Finding Examples

Before creating a questionnaire, search the current project for existing Questionnaire YAML files (typically in a directory like `resources/` or `seeds/`). Existing questionnaires serve as the most reliable reference for project-specific conventions, supported features, and naming patterns. Look for examples that match the complexity of what you're building: simple forms, forms with reference lookups, forms with calculations, forms with conditional logic, etc.
