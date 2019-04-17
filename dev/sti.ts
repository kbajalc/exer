interface MyType {
  instanceMethod(): any;
}

interface MyTypeStatic {
  new(): MyType;
  staticMethod(): any;
}

/* class decorator */
function staticImplements<T>() {
  return (constructor: T) => constructor;
}

// @staticImplements<MyTypeStatic>()   /* this statement implements both normal interface & static interface */
class MyTypeClass { /* implements MyType { */ /* so this become optional not required */
  public static staticMethod() { }
  instanceMethod() { }
}
