---
 tags:
   - Recipe
   - Unclassified
 shop: Tesco
 servings: 1
 ingredients:
   - name: Processed Cheese Slice
     quantity: 2
   - name: Bread 
     quantity: 2
   - name: Baked Beans
     quantity: 210
   - name: Dairy Spread
     quantity: 15
---

```dataviewjs
const { RecipeManager } = customJS;
RecipeManager.shoppingAndPantryLists({dv, recipe: dv.current()});
```
