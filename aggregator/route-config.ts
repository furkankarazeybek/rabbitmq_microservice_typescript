interface RouteConfig {
    actionName: string;
    serviceName: string;
    route: string[];
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', serviceName:"user", route: ["product.getProductList","user.getUserList"] },
    { actionName: 'getRoleList', serviceName:"user", route: ["user.getRoleList"]},
    { actionName: 'getProductList', serviceName:"product", route: ["product.getProductCategoriesList", "product.getProductList"] }
  ];
  
  export default routeConfig;
  