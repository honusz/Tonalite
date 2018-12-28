#include "functions.h"

int functions::mapRange(int num, int inMin, int inMax, int outMin, int outMax){
 return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

Napi::Number functions::MapRangeWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 5 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() || !info[3].IsNumber() || !info[4].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    } 

    Napi::Number first = info[0].As<Napi::Number>();
    Napi::Number second = info[1].As<Napi::Number>();
    Napi::Number third = info[2].As<Napi::Number>();
    Napi::Number fourth = info[3].As<Napi::Number>();
    Napi::Number fifth = info[4].As<Napi::Number>();

    int returnValue = functions::mapRange(first.Int32Value(), second.Int32Value(), third.Int32Value(), fourth.Int32Value(), fifth.Int32Value());
    
    return Napi::Number::New(env, returnValue);
}

Napi::Object functions::Init(Napi::Env env, Napi::Object exports) 
{

  exports.Set("mapRange", Napi::Function::New(env, functions::MapRangeWrapped));
 
  return exports;
}