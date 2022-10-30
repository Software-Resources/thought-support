// TODO: Make it so you can mark recipes you are going to make and the cost of the meals behaves as if those groceries already required are in your pantry (but with the exact amount left over in the pantry)
// TODO: The very cheapest purchase option will be added where the ingredients are priced up using lowest known from multi-shop.
// TODO: Have it fail gracefully in various circumstances, including no products (calories should still work)

class RecipeManager {
  dataForRecipePage(recipePage, dv) {
    // Apologies for the lack of comments here, releasing this code
    // was an afterthought, initially this was just for me.

    const { ThoughtSupportSettings } = customJS;
    const INGREDIENTS_ROOT = ThoughtSupportSettings.get("ingredients_root");

    const pantryList = [];
    const IngredientsPresentInPantry = new Set();

    // TODO: Cache ingredientData for repetition between recipes
    const ingredientData = recipePage.ingredients.reduce(
      (ingredientData, ingredient) => {
        const ingredientPage = dv.page(
          INGREDIENTS_ROOT + "/" + ingredient.name
        );
        if (!ingredientPage) {
          throw new Error(
            "You are missing a page for the ingredient " + ingredient.name
          );
        }
        // Save a list of things in the pantry for displaying to check on
        // TODO: Handle dates
        if (ingredientPage.pantry) {
          pantryList.push(ingredientPage);
          IngredientsPresentInPantry.add(ingredientPage.file.name);
        }
        const productData = ingredientPage.shops.reduce(
          (ingredientAtShops, shop) => {
            ingredientAtShops[shop.name] = {
              productsSortedByCostRatio: shop.products
                .map((product) => {
                  return {
                    ...product,
                    pricePerUnit: product.price / product.quantity,
                  };
                })
                .sort((a, b) => a.pricePerUnit - b.pricePerUnit),
            };
            ingredientAtShops[shop.name].productsSortedByProductCost = [
              ...ingredientAtShops[shop.name].productsSortedByCostRatio,
            ].sort((a, b) => a.price - b.price);
            return ingredientAtShops;
          },
          {}
        );
        ingredientData[ingredient.name] = productData;
        return ingredientData;
      },
      {}
    );
    const totalCostAtShops = {};
    const usedProductServingCostAtShops = {};
    const minusPantryCostAtShops = {};
    const usedProductMinusPantryServingCostAtShops = {};
    const presentAtShop = {};
    const caloriesForRecipeAtShop = {};
    const groceryListAtShops = {};

    for (const ingredient of recipePage.ingredients) {
      const ingredientPage = dv.page(INGREDIENTS_ROOT + "/" + ingredient.name);

      const ingredientAtShops = ingredientData[ingredient.name];
      for (const [shopName, productData] of Object.entries(ingredientAtShops)) {
        const updateCalorieValues = (product, quantity) => {
          if (ingredientPage.pantry) {
            // Do nothing if it's in the pantry, we will fix those up at the end
            return;
          }
          if (product.kcal && product["nutritional quantity"]) {
            caloriesForRecipeAtShop[shopName] +=
              (quantity / cheapestProduct["nutritional quantity"]) *
              product.kcal;
          } else if (
            ingredientPage.kcal &&
            ingredientPage["nutritional quantity"]
          ) {
            caloriesForRecipeAtShop[shopName] +=
              (quantity / ingredientPage["nutritional quantity"]) *
              ingredientPage.kcal;
          } else {
            throw new Error(
              "Neither the ingredient " +
                ingredientPage.file.name +
                " nor the product " +
                product.name +
                " have both 'kcal' and 'nutritional quantity' properties."
            );
          }
        };

        const { productsSortedByCostRatio, productsSortedByProductCost } =
          productData;
        if (!presentAtShop[shopName]) {
          presentAtShop[shopName] = new Set();
        }
        presentAtShop[shopName].add(ingredient.name);
        if (!totalCostAtShops.hasOwnProperty(shopName)) {
          // These are all undefined if the first one is.
          totalCostAtShops[shopName] = 0;
          minusPantryCostAtShops[shopName] = 0;
          usedProductMinusPantryServingCostAtShops[shopName] = 0;
          usedProductServingCostAtShops[shopName] = 0;
          groceryListAtShops[shopName] = [];
          caloriesForRecipeAtShop[shopName] = 0;
        }

        let quantityRemaining = ingredient.quantity;

        // Check what the cheapest product that has all the required
        // quantity is, use that product
        let cheapestProduct = null;
        for (const product of productsSortedByProductCost) {
          if (product.quantity >= quantityRemaining) {
            cheapestProduct = product;
            break;
          }
        }
        if (cheapestProduct) {
          // A cheapest product with all the required quantity was found
          updateCalorieValues(cheapestProduct, quantityRemaining);

          usedProductServingCostAtShops[shopName] +=
            (quantityRemaining / cheapestProduct.quantity) *
            cheapestProduct.price;
          quantityRemaining -= cheapestProduct.quantity;
          totalCostAtShops[shopName] += cheapestProduct.price;
          // TODO: Handle dates
          if (!ingredientPage.pantry) {
            groceryListAtShops[shopName].push(cheapestProduct);
            minusPantryCostAtShops[shopName] += cheapestProduct.price;
            usedProductMinusPantryServingCostAtShops[shopName] +=
              (quantityRemaining / cheapestProduct.quantity) *
              cheapestProduct.price;
          }
        }

        while (quantityRemaining > 0) {
          // Unable to find a product that had all the required
          // amount of the ingredient.
          let foundSortedProduct = false;
          for (const product of productsSortedByCostRatio) {
            if (product.quantity <= quantityRemaining) {
              if (product.quantity <= 0) {
                if (quantityRemaining >= 0) {
                  throw new Error(
                    "Infinite loop detected (product quantity less than or equal to zero)"
                  );
                }
              }

              totalCostAtShops[shopName] += product.price;
              usedProductServingCostAtShops[shopName] += product.price;
              if (!ingredientPage.pantry) {
                updateCalorieValues(product, product.quantity);

                groceryListAtShops[shopName].push(product);
                minusPantryCostAtShops[shopName] += product.price;
                usedProductMinusPantryServingCostAtShops[shopName] +=
                  product.price;
              }
              quantityRemaining -= product.quantity;
              foundSortedProduct = true;
              break;
            }
          }
          if (!foundSortedProduct) {
            // The remaining quantity is now less than supplied by
            // any one product
            cheapestProduct = productsSortedByProductCost[0];

            updateCalorieValues(cheapestProduct, quantityRemaining);

            totalCostAtShops[shopName] += cheapestProduct.price;
            usedProductServingCostAtShops[shopName] +=
              (quantityRemaining / cheapestProduct.quantity) *
              cheapestProduct.price;
            // TODO: Handle dates
            if (!ingredientPage.pantry) {
              groceryListAtShops[shopName].push(cheapestProduct);
              minusPantryCostAtShops[shopName] += cheapestProduct.price;
              usedProductMinusPantryServingCostAtShops[shopName] +=
                cheapestProduct.price;
            }
            quantityRemaining -= cheapestProduct.quantity;
            if (quantityRemaining >= 0) {
              throw new Error(
                "Infinite loop detected (quantity remaining is " +
                  quantityRemaining +
                  ")."
              );
            }
          }
        }
      }
    }

    // Filter out costs at shops where not all ingredients
    // were available.
    for (const shopDictionary of [
      totalCostAtShops,
      usedProductServingCostAtShops,
    ]) {
      const filterShops = [];
      for (const shopName of Object.keys(shopDictionary)) {
        if (recipePage.ingredients.length > presentAtShop[shopName].size) {
          // This means that not all the ingredients had products at a shop
          filterShops.push(shopName);
        }
      }
      for (const deleteShopName of filterShops) {
        delete shopDictionary[deleteShopName];
      }
    }

    // Fix up calories for ingredients in the pantry
    for (const shopName of Object.keys(caloriesForRecipeAtShop)) {
      console.dir(recipePage.ingredients);
      for (const ingredient of recipePage.ingredients) {
        if (!IngredientsPresentInPantry.has(ingredient.name)) {
          continue;
        }
        console.log(INGREDIENTS_ROOT + "/" + ingredient.name);
        const ingredientPage = dv.page(
          INGREDIENTS_ROOT + "/" + ingredient.name
        );
        console.dir(ingredientPage);
        if (ingredientPage.kcal && ingredientPage["nutritional quantity"]) {
          caloriesForRecipeAtShop[shopName] +=
            (ingredient.quantity / ingredientPage["nutritional quantity"]) *
            ingredientPage.kcal;
        } else {
          throw new Error(
            "The ingredient " +
              ingredientPage.file.name +
              " does not have have both 'kcal' and 'nutritional quantity' properties and it is in your pantry."
          );
        }
      }
    }

    // Adjust for servings
    const caloriesPerServingAtShops = {};
    for (const shopName of Object.keys(
      usedProductMinusPantryServingCostAtShops
    )) {
      usedProductMinusPantryServingCostAtShops[shopName] /= recipePage.servings;
    }
    for (const shopName of Object.keys(usedProductServingCostAtShops)) {
      usedProductServingCostAtShops[shopName] /= recipePage.servings;
    }
    for (const shopName of Object.keys(caloriesForRecipeAtShop)) {
      caloriesPerServingAtShops[shopName] = Math.round(
        caloriesForRecipeAtShop[shopName] / recipePage.servings
      );
    }
    // End of adjusting for servings

    // Filter where ingredients are not in either in the pantry
    // or at the shop
    for (const shopDictionary of [
      caloriesPerServingAtShops,
      usedProductMinusPantryServingCostAtShops,
      minusPantryCostAtShops,
      groceryListAtShops,
    ]) {
      const filterShops = [];
      for (const shopName of Object.keys(shopDictionary)) {
        for (const ingredient of recipePage.ingredients) {
          if (
            !IngredientsPresentInPantry.has(ingredient.name) &&
            !presentAtShop[shopName].has(ingredient.name)
          ) {
            console.log(
              "Filtering " +
                shopName +
                " for " +
                ingredient.name +
                " in " +
                recipePage.file.name
            );
            filterShops.push(shopName);
            break;
          }
        }
      }
      for (const deleteShopName of filterShops) {
        delete shopDictionary[deleteShopName];
      }
    }

    return {
      recipe: recipePage,
      totalCostAtShops,
      usedProductMinusPantryServingCostAtShops,
      usedProductServingCostAtShops,
      minusPantryCostAtShops,
      caloriesPerServingAtShops,
      groceryListAtShops,
      pantryList,
    };
  }

  recipes(params) {
    const { dv } = params;
    const { ThoughtSupportSettings } = customJS;
    const RECIPES_ROOT = ThoughtSupportSettings.get("recipes_root");
    const recipePages = dv.pages('"' + RECIPES_ROOT + '"');

    const recipes = recipePages.map((recipePage) =>
      this.dataForRecipePage(recipePage, dv)
    );
    return recipes;
  }

  getCurrencyFormatter(dv) {
    const { ThoughtSupportSettings } = customJS;
    const LOCALE = ThoughtSupportSettings.get("locale");
    const CURRENCY = ThoughtSupportSettings.get("currency");
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: CURRENCY,
    });
  }

  formatRecipeData(recipeData, dv) {
    const currencyFormatter = this.getCurrencyFormatter(dv);
    const showShopCosts = (shopDictionary) =>
      Object.entries(shopDictionary).map(([shopName, shopCost]) => {
        return shopName + ": " + currencyFormatter.format(shopCost);
      });

    return recipeData.map((row) => {
      return [
        row.recipe.file.link,
        showShopCosts(row.minusPantryCostAtShops),
        showShopCosts(row.totalCostAtShops),
        showShopCosts(row.usedProductServingCostAtShops),
        showShopCosts(row.usedProductMinusPantryServingCostAtShops),
        Object.entries(row.caloriesPerServingAtShops).map(
          ([shopName, calories]) => shopName + ": " + calories
        ),
      ];
    });
  }

  pantryList(dv) {
    const { ThoughtSupportSettings } = customJS;
    const INGREDIENTS_ROOT = ThoughtSupportSettings.get("ingredients_root");
    const ingredients = dv.pages('"' + INGREDIENTS_ROOT + '"');
    const pantryItems = ingredients.filter((page) => page.pantry);
    dv.header(2, "Pantry Items");
    dv.paragraph("");
    if (pantryItems.length > 0) {
      dv.list(pantryItems.file.link);
    } else {
      dv.paragraph("Your pantry is empty!");
    }
  }

  shoppingAndPantryLists(params) {
    const { dv, recipe } = params;
    const currencyFormatter = this.getCurrencyFormatter(dv);

    const recipeData = this.dataForRecipePage(recipe, dv);
    if (recipeData.pantryList.length > 0) {
      dv.header(2, "Pantry List");
      dv.paragraph(
        "> [!TIP]\n> Check on your pantry items to see if there's enough for this recipe."
      );
      dv.paragraph("");
      dv.list(recipeData.pantryList.map((page) => page.file.link));
    }
    dv.header(2, "Shopping List(s)");
    dv.paragraph("");
    for (const [shop, products] of Object.entries(
      recipeData.groceryListAtShops
    )) {
      if (products.length === 0) {
        dv.paragraph(
          "> [!DONE]\n> You have everything you need for this recipe in your pantry."
        );
        break;
      }
      let shopTotal = 0;
      dv.header(3, shop);
      dv.table(
        ["Product", "Price"],
        products.map((product) => {
          shopTotal += product.price;
          return [
            product.url
              ? "[" + product.name + "]" + "(" + product.url + ")"
              : product.name,
            currencyFormatter.format(product.price),
          ];
        })
      );
      dv.paragraph("**Total:** " + currencyFormatter.format(shopTotal));
      dv.paragraph("");
    }
  }

  cookbook(params) {
    const { dv } = params;
    const { ThoughtSupportSettings } = customJS;
    const shop = ThoughtSupportSettings.get("recipes_shop");
    const recipes = this.recipes({
      dv,
    });
    const recipeData = recipes.values.sort((a, b) => {
      // This takes care of the case where recipes are not available
      // at the selected shop
      if (
        !a.totalCostAtShops.hasOwnProperty(shop) &&
        !b.totalCostAtShops.hasOwnProperty(shop)
      ) {
        return 0;
      }
      if (!a.totalCostAtShops.hasOwnProperty(shop)) {
        return 1;
      }
      if (!b.totalCostAtShops.hasOwnProperty(shop)) {
        return -1;
      }

      return a.minusPantryCostAtShops[shop] - b.minusPantryCostAtShops[shop];
    });

    dv.header(1, "Recipes by Cost");
    dv.header(2, "*(Buy Everything - Pantry Excluded)*");
    dv.paragraph("");
    dv.table(
      [
        "Recipe",
        "Cost (Buy Everything - Pantry Excluded)",
        "Cost (Buy Everything)",
        "Cost Per Serving (Used Ingredients Only)",
        "Cost Per Serving (Used Ingredients Only - Pantry Excluded)",
        "Calories (Per Serving)",
      ],
      this.formatRecipeData(recipeData, dv)
    );

    dv.paragraph("");
    dv.header(1, "Recipes by Calories");
    dv.paragraph("");
    dv.table(
      [
        "Recipe",
        "Cost (Buy Everything - Pantry Excluded)",
        "Cost (Buy Everything)",
        "Cost Per Serving (Used Ingredients Only)",
        "Cost Per Serving (Used Ingredients Only - Pantry Excluded)",
        "Calories (Per Serving)",
      ],
      this.formatRecipeData(
        recipeData.sort((a, b) => {
          // This takes care of the case where recipes are not available
          // at the selected shop
          if (
            !a.caloriesPerServingAtShops.hasOwnProperty(shop) &&
            !b.caloriesPerServingAtShops.hasOwnProperty(shop)
          ) {
            return 0;
          }
          if (!a.caloriesPerServingAtShops.hasOwnProperty(shop)) {
            return 1;
          }
          if (!b.caloriesPerServingAtShops.hasOwnProperty(shop)) {
            return -1;
          }

          return (
            a.caloriesPerServingAtShops[shop] -
            b.caloriesPerServingAtShops[shop]
          );
        }),
        dv
      )
    );
  }
}
