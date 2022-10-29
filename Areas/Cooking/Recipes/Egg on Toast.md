---
 tags:
   - Recipe
   - Unclassified
 shop: Tesco
 servings: 1
 ingredients:
   - name: Egg
     quantity: 3
   - name: Bread
     quantity: 2
   - name: Dairy Spread
     quantity: 15
---

```dataviewjs
const { RecipeManager } = customJS;
RecipeManager.shoppingAndPantryLists({dv, recipe: dv.current()});
```
