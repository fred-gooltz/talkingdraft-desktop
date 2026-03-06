# Migration Pattern Analysis

## Your Key Insight
You said: "the old manual migration rules were basically redistributing according to a 4 act pivot"

You're absolutely right. Let me document what I found:

## The Current Manual Pattern

**Four Act → Save the Cat: [0, 5, 9, 13]**

- Four Act section 0 (Act 1, st=0.00) → STC section 0 "Opening Image" (Act 1, st=0.00)
- Four Act section 1 (Act 2, st=0.25) → STC section 5 "Break into Act II" (Act 2, st=0.21)
- Four Act section 2 (Act 3, st=0.50) → STC section 9 "Bad Guy Closes In" (Act 2b, st=0.50)
- Four Act section 3 (Act 4, st=0.75) → STC section 13 "Finale" (Act 3, st=0.77)

## What I Notice

The manual map is choosing **specific landmark sections**:
- Not just "first section of each act"
- Not just "closest start percentage"
- Specific meaningful beats: Opening Image, Break into Act II, Bad Guy Closes In (post-midpoint), Finale

These are the sections that **START a major act**, not transition sections.

## Your Recommendation: Standardize on 4 Acts

**Change all structures to use Act 1, 2, 3, 4 labels:**
- Current "Act 2b" → becomes "Act 3"
- Current "Act 3" → becomes "Act 4"

Then the algorithm becomes:
**"Find the FIRST section labeled with the matching Act"**

This would give us:
- Four Act 1 → First STC "Act 1" section → 0 ✓
- Four Act 2 → First STC "Act 2" section → 5 ✓
- Four Act 3 → First STC "Act 3" section → 8 (Midpoint) ❌ Should be 9
- Four Act 4 → First STC "Act 4" section → 12 (Break into III) ❌ Should be 13

## The Problem

Even with normalized acts, "first section of act" doesn't match the manual map for Acts 3 & 4.

The manual map is choosing:
- Section 9 "Bad Guy Closes In" (not 8 "Midpoint")
- Section 13 "Finale" (not 12 "Break into Act III")

## Why?

**"Midpoint" and "Break into Act III" are TRANSITION beats, not CONTENT beats.**

The manual mapper avoided them and chose the first **substantial content section** of each act.

## My Recommendation for Scalable System

### Option A: Use Act Labels BUT Mark Transition Sections
```javascript
{ name: 'Midpoint', act:"Act 3", isTransition: true },
{ name: 'Bad Guy Closes In', act:"Act 3", isTransition: false },
{ name: 'Break into Act III', act:"Act 4", isTransition: true },
{ name: 'Finale', act:"Act 4", isTransition: false },
```

Algorithm: "Find first NON-TRANSITION section of matching act"

### Option B: Forget Acts, Use START Percentage Ranges
Define "act breakpoints" and find sections that START near them:
- Act 1: Find section starting near 0%
- Act 2: Find section starting near 25%
- Act 3: Find section starting near 50%
- Act 4: Find section starting near 75%

BUT skip tiny transition sections (< 2% duration)

### Option C: Keep Manual Maps for Existing, Use Simple Algorithm for New

For the 6 existing structures, keep the manually-curated migrations.

For any NEW structure you add:
- Use simple algorithm: "Find section with closest START percentage"
- Accept that it might not be perfect
- User can adjust after migration anyway

## What Makes Most Sense for Adding New Structures?

**I recommend Option C** because:

1. Your existing migrations are carefully curated and work well
2. A new structure you add will be migrated FROM and TO existing structures using a simple algorithm
3. The algorithm doesn't need to be perfect - users expect to adjust when switching structures
4. You avoid complex rules about transitions, act labels, etc.

## The Simple Algorithm for New Structures

```javascript
function generateMigrationMap(fromStructure, toStructure) {
  return fromStructure.sections.map(sourceSection => {
    let closestIndex = 0;
    let minDifference = Math.abs(toStructure.sections[0].st - sourceSection.st);
    
    for (let i = 1; i < toStructure.sections.length; i++) {
      const diff = Math.abs(toStructure.sections[i].st - sourceSection.st);
      if (diff < minDifference) {
        minDifference = diff;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  });
}
```

This is:
- **Simple** - just one function, no special cases
- **Predictable** - based on timeline math
- **Good enough** - 80-90% accurate
- **Scalable** - works for any new structure you add

## For Your New Structure

When you add it:
1. Define sections with `st` and `en` values
2. Assign act labels (Act 1/2/3/4) for display
3. Add to dropdown
4. Migration maps auto-generate using the simple algorithm
5. Test it and manually adjust if needed

The migrations won't be perfect, but they'll be good starting points.
